/**
 * Gera cobrança automaticamente no Mercado Pago ao aprovar um pedido.
 * Chamado pelo PATCH /api/pedidos/[id] quando status → APROVADO.
 * Nunca lança exceção — falha silenciosa com log.
 */

import { prisma } from "@/lib/prisma";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { sendCobrancaEmail } from "@/lib/email";

export async function autoGerarCobranca(orderId: string, tenantId: string): Promise<void> {
  try {
    const [order, tenant] = await Promise.all([
      prisma.order.findFirst({
        where: { id: orderId, tenantId },
        include: {
          client: { select: { name: true, email: true, decisorEmail: true, nomeFantasia: true } },
          items: { include: { product: { select: { name: true } } } },
          // Não gera segunda cobrança se já tiver payment pendente ou pago
          payments: { where: { status: { in: ["PENDENTE", "PAGO"] } } },
        },
      }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, mpAccessToken: true, emailRemetente: true },
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
      const recipients = [order.client.decisorEmail, order.client.email].filter(Boolean) as string[];
      await sendCobrancaEmail(
        [...new Set(recipients)],
        tenant.name,
        order.client.nomeFantasia ?? order.client.name ?? order.client.email,
        orderId,
        total,
        checkoutUrl,
        dueDate,
        tenant.emailRemetente,
      );
      console.log("[COBRANCA-AUTO] cobrança gerada e email enviado para pedido", orderId);
    }
  } catch (err) {
    console.error("[COBRANCA-AUTO] erro inesperado:", err);
  }
}
