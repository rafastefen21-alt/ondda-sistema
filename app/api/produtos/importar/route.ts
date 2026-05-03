import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const rowSchema = z.object({
  nome:          z.string().min(1, "nome obrigatório"),
  descricao:     z.string().optional(),
  preco:         z.number().positive("preço deve ser positivo"),
  unidade:       z.string().default("un"),
  categoria:     z.string().optional(),
  qtd_minima:    z.number().positive().optional(),
  validade_dias: z.number().int().positive().optional(),
  ncm:           z.string().max(10).optional(),
  cfop:          z.string().max(5).optional(),
  ativo:         z.boolean().default(true),
});

const importSchema = z.array(rowSchema).min(1).max(500);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = session.user.tenantId;

  const body = await req.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rows = parsed.data;
  const errors: string[] = [];
  let created = 0;

  // Collect unique category names — find existing or create
  const categoryNames = [...new Set(rows.map((r) => r.categoria).filter(Boolean))] as string[];

  const categoryMap = new Map<string, string>(); // name → id
  for (const name of categoryNames) {
    let cat = await prisma.productCategory.findFirst({ where: { tenantId, name } });
    if (!cat) {
      cat = await prisma.productCategory.create({ data: { tenantId, name } });
    }
    categoryMap.set(name, cat.id);
  }

  // Insert products
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await prisma.product.create({
        data: {
          tenantId,
          name:          row.nome,
          description:   row.descricao ?? null,
          price:         row.preco as unknown as never,
          unit:          row.unidade,
          categoryId:    row.categoria ? (categoryMap.get(row.categoria) ?? null) : null,
          minQuantity:   row.qtd_minima != null ? (row.qtd_minima as unknown as never) : null,
          shelfLifeDays: row.validade_dias ?? null,
          ncm:           row.ncm ?? null,
          cfop:          row.cfop ?? "5102",
          active:        row.ativo,
        },
      });
      created++;
    } catch (err) {
      errors.push(`Linha ${i + 2}: ${err instanceof Error ? err.message : "erro desconhecido"}`);
    }
  }

  return NextResponse.json({ created, errors });
}
