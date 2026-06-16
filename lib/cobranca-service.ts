/**
 * Gera cobrança automaticamente no Mercado Pago ao aprovar um pedido.
 * Chamado pelo PATCH /api/pedidos/[id] quando status → APROVADO.
 * Nunca lança exceção — falha silenciosa com log.
 */

import { prisma } from "@/lib/prisma";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { sendCobrancaEmail } from "@/lib/email";
import { mergeNotificacoes, renderNotifMessage } from "@/lib/notificacoes";
import { zapiSendText } from "@/lib/zapi";

export async function autoGerarCobranca(orderId: string, tenantId: string): Promise<void> {
  try {
    const [order, tenant] = await Promise.all([
      prisma.order.findFirst({
        where: { id: orderId, tenantId },
        include: {
          client: { select: { name: true, email: true, decisorEmail: true, nomeFantasia: true, phone: true, decisorPhone: true } },
          items: { include: { product: { select: { name: true } } } },
          // Não gera segunda cobrança se já tiver payment pendente ou pago
          payments: { where: { status: { in: ["PENDENTE", "PAGO"] } } },
        },
      }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, mpAccessToken: true, emailRemetente: true, zapiInstanceId: true, zapiToken: true, notificacoes: true },
      }),
    ]);

    if (!order || !tenant?.mpAccessToken) return;

    // Já tem cobrança ativa
    if (order.payments.length > 0) {
      console.log("[COBRANCA-AUTO] já existe cobrança para pedido", orderId);
      return;
    }

    const total = order.items.reduce(
      (s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0,
    );
    if (total <= 0) return;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    const payment = await prisma.payment.create({
      data: {
        tenantId,
        orderId,
        amount: total as never,
        method: (order.paymentMethod ?? "PIX") as never,
        dueDate,
        status: "PENDENTE",
      },
    });

    const mpClient = new MercadoPagoConfig({ accessToken: tenant.mpAccessToken });
    const preferenceApi = new Preference(mpClient);
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

    const itemTitle =
      order.items.length === 1
        ? order.items[0].product.name
        : `Pedido #${orderId.slice(-6).toUpperCase()} — ${tenant.name}`;

    const preference = await preferenceApi.create({
      body: {
        items: [{ id: payment.id.slice(-30), title: itemTitle, quantity: 1, unit_price: total, currency_id: "BRL" }],
        external_reference: payment.id,
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
        back_urls: {
          success: `${baseUrl}/pedidos/${orderId}`,
          failure: `${baseUrl}/pedidos/${orderId}`,
          pending: `${baseUrl}/pedidos/${orderId}`,
        },
        auto_return: "approved",
        statement_descriptor: tenant.name.slice(0, 22),
      },
    });

    const checkoutUrl = preference.sandbox_init_point ?? preference.init_point ?? null;

    await prisma.payment.update({
      where: { id: payment.id },
      data: { mpPaymentId: preference.id?.toString() ?? null },
    });

    if (checkoutUrl) {
      const notif = mergeNotificacoes(tenant.notificacoes);
      const clientName = order.client.nomeFantasia ?? order.client.name ?? order.client.email;
      const shortId = orderId.slice(-8).toUpperCase();
      const fmtBrl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

      // E-mail
      if (notif.email.cobrancaGerada) {
        const recipients = [order.client.decisorEmail, order.client.email].filter(Boolean) as string[];
        await sendCobrancaEmail(
          [...new Set(recipients)],
          tenant.name,
          clientName,
          orderId,
          total,
          checkoutUrl,
          dueDate,
          tenant.emailRemetente,
        );
      }

      // WhatsApp
      const phone = order.client.phone ?? order.client.decisorPhone ?? null;
      if (notif.whatsapp.cobrancaGerada && tenant.zapiInstanceId && tenant.zapiToken && phone) {
        const msg = renderNotifMessage(notif.mensagens.cobrancaGerada, {
          nome: clientName, pedido: shortId, valor: fmtBrl(total),
        });
        zapiSendText({ instanceId: tenant.zapiInstanceId, token: tenant.zapiToken }, phone, msg)
          .catch((e) => console.error("[COBRANCA-AUTO] WA error:", e));
      }

      console.log("[COBRANCA-AUTO] cobrança gerada para pedido", orderId);
    }
  } catch (err) {
    console.error("[COBRANCA-AUTO] erro inesperado:", err);
  }
}
