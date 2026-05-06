import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adjustStock } from "@/lib/stock";
import { z } from "zod";

// GET /api/estoque — lista todos os produtos com estoque do tenant
export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { tenantId } = session.user;

  // Busca todos os produtos ativos + seu stockItem (se houver)
  const products = await prisma.product.findMany({
    where:   { tenantId, active: true },
    include: { stockItem: true, category: { select: { name: true } } },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });

  return NextResponse.json(products);
}

// POST /api/estoque — ajuste manual de estoque
const adjustSchema = z.object({
  productId: z.string(),
  delta:     z.number(),
  type:      z.enum(["ENTRADA", "SAIDA", "AJUSTE"]),
  reason:    z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = adjustSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Garante que o produto é do tenant
  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, tenantId: session.user.tenantId },
  });
  if (!product) {
    return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  }

  const updated = await adjustStock({
    tenantId:  session.user.tenantId,
    productId: parsed.data.productId,
    delta:     parsed.data.delta,
    type:      parsed.data.type,
    reason:    parsed.data.reason,
  });

  return NextResponse.json(updated);
}
