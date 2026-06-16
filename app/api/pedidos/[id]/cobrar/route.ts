import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { sendCobrancaEmail } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Fetch order with items
  const order = await prisma.order.findFirst({
    where: { id, tenantId },
    include: {
      client: { select: { name: true, email: true, decisorEmail: true } },
      items: {
        include: { product: { select: { name: true } } },
      },
      payments: { where: { status: { in: ["PENDENTE", "PAGO"] } }, select: { id: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  if (order.payments.length > 0) {
    return NextResponse.json(
      { error: "Já existe uma cobrança ativa para este pedido." },
      { status: 409 },
    );
  }

  if (["CANCELADO", "RASCUNHO"].includes(order.status)) {
    return NextResponse.json(
      { error: "Pedido não pode ser cobrado neste status" },
      { status: 400 }
    );
  }

  // Calculate total
  const total = order.items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * Number(item.quantity),
    0
  );

  if (total <= 0) {
    return NextResponse.json({ error: "Total do pedido é zero" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const paymentMethod =
    (body.paymentMethod as string) ||
    (order.paymentMethod as string | null) ||
    "PIX";

  // Due date: next business day (tomorrow)
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      tenantId,
      orderId: id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      amount: total as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      method: paymentMethod as any,
      dueDate,
      status: "PENDENTE",
    },
  });

  // Try to generate MP checkout link
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { mpAccessToken: true, name: true, emailRemetente: true },
  });

  if (!tenant?.mpAccessToken) {
    return NextResponse.json({ paymentId: payment.id, checkoutUrl: null });
  }

  const mpClient = new MercadoPagoConfig({ accessToken: tenant.mpAccessToken });
  const preferenceApi = new Preference(mpClient);
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  const itemTitle =
    order.items.length === 1
      ? order.items[0].product.name
      : `Pedido #${order.id.slice(-6).toUpperCase()} — ${tenant.name}`;

  try {
    const preference = await preferenceApi.create({
      body: {
        items: [
          {
            id: payment.id.slice(-30),
            title: itemTitle,
            quantity: 1,
            unit_price: total,
            currency_id: "BRL",
          },
        ],
        // Omit payer to avoid "payer is the seller" error on test accounts
        external_reference: payment.id,
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
        back_urls: {
          success: `${baseUrl}/pedidos/${order.id}`,
          failure: `${baseUrl}/pedidos/${order.id}`,
          pending: `${baseUrl}/pedidos/${order.id}`,
        },
        auto_return: "approved",
        statement_descriptor: tenant.name.slice(0, 22),
      },
    });

    // Não armazena preference.id em mpPaymentId — o webhook usa external_reference
    // e atualiza mpPaymentId com o real MP Payment ID quando processa o pagamento.

    const checkoutUrl = preference.sandbox_init_point ?? preference.init_point ?? null;

    if (checkoutUrl) {
      const recipients = [
        order.client.decisorEmail,
        order.client.email,
      ].filter(Boolean) as string[];
      sendCobrancaEmail(
        [...new Set(recipients)],
        tenant.name,
        order.client.name ?? order.client.email,
        order.id,
        total,
        checkoutUrl,
        payment.dueDate,
        tenant.emailRemetente,
      ).catch((e) => console.error("[cobrar] email erro:", e));
    }

    return NextResponse.json({ paymentId: payment.id, checkoutUrl });
  } catch (err: unknown) {
    const mpErr = err as { message?: string; cause?: { error?: string; message?: string } };
    const detail = mpErr?.cause?.message ?? mpErr?.cause?.error ?? mpErr?.message ?? "Erro desconhecido";
    console.error("[cobrar] MP error:", err);
    // Payment already created — return paymentId so client can retry
    return NextResponse.json({ paymentId: payment.id, checkoutUrl: null, mpError: detail });
  }
}
