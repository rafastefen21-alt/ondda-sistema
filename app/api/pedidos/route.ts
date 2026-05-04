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
        notes: z.string().optional(),
      })
    )
    .min(1),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  requestedDate: z.string().optional(),
  scheduledDeliveryDate: z.string().optional(),
  deliveryAddress: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  // Admin-only fields
  clientId: z.string().optional(),
  status: z.enum(["RASCUNHO", "PENDENTE_APROVACAO", "APROVADO"]).optional(),
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

  const { tenantId, role, id: sessionUserId } = session.user;
  const isAdmin = ["TENANT_ADMIN", "SUPER_ADMIN", "GERENTE"].includes(role);

  // Resolve clientId
  let clientId = sessionUserId;
  if (parsed.data.clientId && isAdmin) {
    // Verify the client belongs to this tenant
    const client = await prisma.user.findFirst({
      where: { id: parsed.data.clientId, tenantId },
    });
    if (!client) {
      return NextResponse.json({ error: "Cliente inválido" }, { status: 400 });
    }
    clientId = parsed.data.clientId;
  }

  // Verify all products belong to this tenant
  const productIds = parsed.data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId },
  });
  if (products.length !== productIds.length) {
    return NextResponse.json({ error: "Produto inválido" }, { status: 400 });
  }

  // Determine initial status
  const initialStatus = (isAdmin && parsed.data.status) ? parsed.data.status : "PENDENTE_APROVACAO";

  const order = await prisma.order.create({
    data: {
      tenantId,
      clientId,
      status: initialStatus,
      notes:         parsed.data.notes ?? null,
      internalNotes: parsed.data.internalNotes ?? null,
      requestedDate: parsed.data.requestedDate ? new Date(parsed.data.requestedDate) : null,
      scheduledDeliveryDate: parsed.data.scheduledDeliveryDate ? new Date(parsed.data.scheduledDeliveryDate) : null,
      deliveryAddress: parsed.data.deliveryAddress ?? null,
      paymentMethod:   parsed.data.paymentMethod ?? null,
      // If admin creates as APROVADO, record approval info
      ...(initialStatus === "APROVADO" ? {
        approvedAt:   new Date(),
        approvedById: sessionUserId,
      } : {}),
      items: {
        create: parsed.data.items.map((item) => ({
          productId: item.productId,
          quantity:  item.quantity,
          unitPrice: item.unitPrice,
          notes:     item.notes ?? null,
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
