import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MercadoPago from "mercadopago";

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

  // Fetch payment with order details
  const payment = await prisma.payment.findFirst({
    where: { id, tenantId },
    include: {
      order: {
        include: {
          client: { select: { name: true, email: true } },
          items: { include: { product: { select: { name: true } } } },
        },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
  }

  if (payment.status === "PAGO") {
    return NextResponse.json({ error: "Pagamento já foi realizado" }, { status: 400 });
  }

  // Fetch tenant MP credentials
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { mpAccessToken: true, name: true, slug: true },
  });

  if (!tenant?.mpAccessToken) {
    return NextResponse.json(
      { error: "Mercado Pago não configurado. Adicione o Access Token nas Configurações." },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mp = new MercadoPago({ accessToken: tenant.mpAccessToken }) as any;

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const amount = Number(payment.amount);

  const itemTitle = payment.order.items.length === 1
    ? payment.order.items[0].product.name
    : `Pedido #${payment.order.id.slice(-6).toUpperCase()} — ${tenant.name}`;

  try {
    const preference = await mp.preferences.create({
      body: {
        items: [
          {
            id: payment.id,
            title: itemTitle,
            quantity: 1,
            unit_price: amount,
            currency_id: "BRL",
          },
        ],
        payer: {
          name: payment.order.client?.name ?? undefined,
          email: payment.order.client?.email ?? undefined,
        },
        external_reference: payment.id,
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
        back_urls: {
          success: `${baseUrl}/pedidos/${payment.order.id}`,
          failure: `${baseUrl}/pedidos/${payment.order.id}`,
          pending: `${baseUrl}/pedidos/${payment.order.id}`,
        },
        auto_return: "approved",
        statement_descriptor: tenant.name.slice(0, 22),
      },
    });

    // Save the MP payment link on the payment record (mpPaymentId = preference id)
    await prisma.payment.update({
      where: { id: payment.id },
      data: { mpPaymentId: preference.id?.toString() ?? null },
    });

    return NextResponse.json({
      checkoutUrl: preference.sandbox_init_point ?? preference.init_point,
      preferenceId: preference.id,
    });
  } catch (err) {
    console.error("[MP] Error creating preference:", err);
    return NextResponse.json(
      { error: "Erro ao criar link de pagamento no Mercado Pago." },
      { status: 500 }
    );
  }
}
