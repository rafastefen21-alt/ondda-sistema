import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const products = await prisma.product.findMany({
    where: { tenantId: session.user.tenantId },
    include: { category: true },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });

  const headers = ["nome", "descricao", "preco", "unidade", "categoria", "qtd_minima", "validade_dias", "ncm", "cfop", "ativo"];

  const rows = products.map((p) => [
    escapeCsv(p.name),
    escapeCsv(p.description),
    escapeCsv(Number(p.price)),
    escapeCsv(p.unit),
    escapeCsv(p.category?.name),
    escapeCsv(p.minQuantity ? Number(p.minQuantity) : null),
    escapeCsv(p.shelfLifeDays),
    escapeCsv(p.ncm),
    escapeCsv(p.cfop),
    escapeCsv(p.active ? "sim" : "nao"),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="produtos.csv"',
    },
  });
}
