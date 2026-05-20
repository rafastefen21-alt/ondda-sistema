import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  title:      z.string().min(1).max(120),
  quantity:   z.string().max(40).optional(),
  notes:      z.string().max(500).optional(),
  expectedAt: z.string().optional(), // ISO date string
});

/** GET /api/fabrica/pedidos — lista todos os pedidos à fábrica do tenant */
export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "CLIENTE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orders = await prisma.factoryOrder.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(orders);
}

/** POST /api/fabrica/pedidos — cria um novo pedido à fábrica */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, quantity, notes, expectedAt } = parsed.data;

  const order = await prisma.factoryOrder.create({
    data: {
      tenantId:   session.user.tenantId,
      title,
      quantity:   quantity ?? null,
      notes:      notes ?? null,
      expectedAt: expectedAt ? new Date(expectedAt) : null,
    },
  });

  return NextResponse.json(order, { status: 201 });
}
