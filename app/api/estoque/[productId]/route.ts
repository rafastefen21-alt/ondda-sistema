import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/estoque/[productId] — atualiza limite de alerta
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { alertThreshold } = await req.json();

  // Upsert do StockItem com o novo threshold
  const item = await prisma.stockItem.upsert({
    where:  { productId },
    create: {
      tenantId:       session.user.tenantId,
      productId,
      quantity:       0,
      alertThreshold: alertThreshold ?? null,
    },
    update: { alertThreshold: alertThreshold ?? null },
  });

  return NextResponse.json(item);
}

// GET /api/estoque/[productId]/movimentos — histórico de movimentações
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const stockItem = await prisma.stockItem.findFirst({
    where:   { productId, tenantId: session.user.tenantId },
    include: {
      movements: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  return NextResponse.json(stockItem ?? { movements: [] });
}
