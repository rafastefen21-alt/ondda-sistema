import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const priceEntrySchema = z.object({
  productId:   z.string(),
  price:       z.number().positive().nullable(),
  pricePacote: z.number().positive().nullable(),
  priceCaixa:  z.number().positive().nullable(),
});

const putSchema = z.array(priceEntrySchema);

/**
 * GET /api/clientes/[id]/precos
 * Retorna os preços personalizados do cliente.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;
  const { tenantId } = session.user;

  const prices = await prisma.clientProductPrice.findMany({
    where: { clientId: id, tenantId },
    select: { productId: true, price: true, pricePacote: true, priceCaixa: true },
  });

  return NextResponse.json(
    prices.map((p) => ({
      productId:   p.productId,
      price:       p.price       ? Number(p.price)       : null,
      pricePacote: p.pricePacote ? Number(p.pricePacote) : null,
      priceCaixa:  p.priceCaixa  ? Number(p.priceCaixa)  : null,
    })),
  );
}

/**
 * PUT /api/clientes/[id]/precos
 * Salva (upsert) os preços personalizados do cliente.
 * Entradas com todos os preços null são deletadas.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id: clientId } = await params;
  const { tenantId } = session.user;

  // Confirma que o cliente pertence ao tenant
  const client = await prisma.user.findFirst({ where: { id: clientId, tenantId, role: "CLIENTE" } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const body   = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  // Upsert em transação
  await prisma.$transaction(
    parsed.data.map((entry) => {
      const hasAny = entry.price !== null || entry.pricePacote !== null || entry.priceCaixa !== null;
      if (!hasAny) {
        // Remove se existir
        return prisma.clientProductPrice.deleteMany({
          where: { clientId, productId: entry.productId },
        });
      }
      return prisma.clientProductPrice.upsert({
        where:  { clientId_productId: { clientId, productId: entry.productId } },
        create: {
          tenantId,
          clientId,
          productId:   entry.productId,
          price:       entry.price       ?? null,
          pricePacote: entry.pricePacote ?? null,
          priceCaixa:  entry.priceCaixa  ?? null,
        },
        update: {
          price:       entry.price       ?? null,
          pricePacote: entry.pricePacote ?? null,
          priceCaixa:  entry.priceCaixa  ?? null,
        },
      });
    }),
  );

  return NextResponse.json({ ok: true });
}
