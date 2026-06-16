import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MercadoPagoConfig, Payment as MpPayment } from "mercadopago";
import { sendPagamentoConfirmadoEmail } from "@/lib/email";
import { autoEmitirNfe } from "@/lib/nfe-service";
import { mergeNotificacoes, renderNotifMessage } from "@/lib/notificacoes";
import { zapiSendText } from "@/lib/zapi";

// MP sends GET to verify the endpoint on setup
export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    // MP sends payment notifications as type "payment"
    if (type !== "payment" || !data?.id) {
      return NextResponse.json({ status: "ignored" });
    }

    const mpPaymentId = String(data.id);

    // Find which payment (and tenant) this belongs to
    // The external_reference on the preference points to our Payment.id
    // But the webhook gives us the MP payment id — we need to look it up
    // We'll find the tenant by looking at all tenants that have an mpAccessToken
    // and trying to fetch the payment from MP

    // First try: find our payment by mpPaymentId (if already linked)
    let payment = await prisma.payment.findFirst({
      where: { mpPaymentId },
      include: { order: { select: { tenantId: true } } },
    });

    // If not found by mpPaymentId, fetch from MP to get external_reference
    if (!payment) {
      // Try to find any tenant with MP configured to fetch the payment info
      const tenants = await prisma.tenant.findMany({
        where: { mpAccessToken: { not: null } },
        select: { id: true, mpAccessToken: true },
      });

      for (const tenant of tenants) {
        try {
          const mpClient = new MercadoPagoConfig({ accessToken: tenant.mpAccessToken! });
          const mpPaymentApi = new MpPayment(mpClient);
          const mpPayment = await mpPaymentApi.get({ id: Number(mpPaymentId) });

          const externalRef = (mpPayment as { external_reference?: string }).external_reference;
          if (!externalRef) continue;

          // external_reference is our Payment.id
          const found = await prisma.payment.findFirst({
            where: { id: externalRef, tenantId: tenant.id },
            include: { order: { select: { tenantId: true } } },
          });

          if (found) {
            payment = found;
            // Link the MP payment id for future webhooks
            await prisma.payment.update({
              where: { id: found.id },
              data: { mpPaymentId },
            });
            break;
          }
        } catch {
          // Not this tenant's payment, continue
          continue;
        }
      }
    }

    if (!payment) {
      return NextResponse.json({ status: "not_found" });
    }

    // Fetch actual MP payment status
    const tenantRecord = await prisma.tenant.findUnique({
      where: { id: payment.order.tenantId },
      select: { mpAccessToken: true },
    });

    if (!tenantRecord?.mpAccessToken) {
      return NextResponse.json({ status: "no_token" });
    }

    const mpClient2 = new MercadoPagoConfig({ accessToken: tenantRecord.mpAccessToken });
    const mpPaymentApi2 = new MpPayment(mpClient2);
    const mpPayment = await mpPaymentApi2.get({ id: Number(mpPaymentId) });
    const mpStatus = mpPayment.status;

    // Map MP status to our PaymentStatus
    let newStatus: "PAGO" | "PENDENTE" | "CANCELADO" | null = null;
    if (mpStatus === "approved") newStatus = "PAGO";
    else if (mpStatus === "cancelled" || mpStatus === "rejected") newStatus = "CANCELADO";
    else if (mpStatus === "pending" || mpStatus === "in_process") newStatus = "PENDENTE";

    if (newStatus && newStatus !== payment.status) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
          mpStatus,
          ...(newStatus === "PAGO" ? { paidAt: new Date() } : {}),
        },
      });

      // Quando pagamento confirmado: email + NF-e automática
      if (newStatus === "PAGO") {
        const orderId = payment.orderId;
        const tenantId = payment.order.tenantId;

        // Busca dados do pedido/cliente/tenant para email e NF-e
        const orderFull = await prisma.order.findFirst({
          where: { id: orderId, tenantId },
          include: {
            client: { select: { name: true, email: true, decisorEmail: true, nomeFantasia: true, phone: true, decisorPhone: true } },
            items: true,
            tenant: { select: { name: true, emailRemetente: true, zapiInstanceId: true, zapiToken: true, notificacoes: true } },
          },
        });

        if (orderFull) {
          const total = orderFull.items.reduce(
            (s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0,
          );
          const notif = mergeNotificacoes(orderFull.tenant.notificacoes);
          const clientName = orderFull.client.nomeFantasia ?? orderFull.client.name ?? orderFull.client.email;
          const shortId = orderId.slice(-8).toUpperCase();
          const fmtBrl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

          // E-mail confirmação de pagamento
          if (notif.email.pagamentoConfirmado) {
            const recipients = [
              orderFull.client.decisorEmail,
              orderFull.client.email,
            ].filter(Boolean) as string[];
            sendPagamentoConfirmadoEmail(
              [...new Set(recipients)],
              orderFull.tenant.name,
              clientName,
              orderId,
              total,
              orderFull.tenant.emailRemetente,
            ).catch((e) => console.error("[MP-webhook] email pagamento:", e));
          }

          // WhatsApp confirmação de pagamento
          const phone = orderFull.client.phone ?? orderFull.client.decisorPhone ?? null;
          if (notif.whatsapp.pagamentoConfirmado && orderFull.tenant.zapiInstanceId && orderFull.tenant.zapiToken && phone) {
            const msg = renderNotifMessage(notif.mensagens.pagamentoConfirmado, {
              nome: clientName, pedido: shortId, valor: fmtBrl(total),
            });
            zapiSendText(
              { instanceId: orderFull.tenant.zapiInstanceId, token: orderFull.tenant.zapiToken },
              phone, msg,
            ).catch((e) => console.error("[MP-webhook] WA pagamento:", e));
          }

          // Emissão automática de NF-e (fire-and-forget)
          autoEmitirNfe(orderId, tenantId)
            .catch((e) => console.error("[MP-webhook] auto NF-e:", e));
        }
      }
    }

    return NextResponse.json({ status: "processed" });
  } catch (err) {
    console.error("[MP Webhook] Error:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
