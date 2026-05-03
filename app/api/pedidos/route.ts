import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const PAYMENT_METHODS = ["PIX", "BOLETO", "CARTAO_CREDITO", "CARTAO_DEBITO", "DINHEIRO", "TRANSFERENCIA"] as const;

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
      })
    )
    .min(1),
  notes: z.string().optional(),
  requestedDate: z.string().optional(),
  deliveryAddress: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Verify all products belong to this tenant
  const productIds = parsed.data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId: session.user.tenantId },
  });
  if (products.length !== productIds.length) {
    return NextResponse.json(
      { error: "Produto inválido" },
      { status: 400 }
    );
  }

  const order = await prisma.order.create({
    data: {
      tenantId: session.user.tenantId,
      clientId: session.user.id,
      status: "PENDENTE_APROVACAO",
      notes: parsed.data.notes,
      requestedDate: parsed.data.requestedDate
        ? new Date(parsed.data.requestedDate)
        : null,
      deliveryAddress: parsed.data.deliveryAddress,
      paymentMethod: parsed.data.paymentMethod ?? null,
      items: {
        create: parsed.data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json(order, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 20;

  const isClient = session.user.role === "CLIENTE";
  const where = {
    tenantId: session.user.tenantId,
    ...(isClient ? { clientId: session.user.id } : {}),
    ...(status ? { status: status as never } : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        client: { select: { name: true, email: true } },
        items: {
          include: { product: { select: { name: true, unit: true } } },
        },
        _count: { select: { payments: true, invoices: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({ orders, total, page, limit });
}
