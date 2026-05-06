import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EstoqueClient } from "./estoque-client";

export default async function EstoquePage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(role)) redirect("/dashboard");

  const products = await prisma.product.findMany({
    where:   { tenantId, active: true },
    include: {
      stockItem: { include: { movements: { orderBy: { createdAt: "desc" }, take: 5 } } },
      category:  { select: { name: true } },
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });

  const items = products.map((p) => ({
    id:            p.id,
    name:          p.name,
    unit:          p.unit,
    ncm:           p.ncm ?? null,
    categoryName:  p.category?.name ?? null,
    quantity:      p.stockItem ? Number(p.stockItem.quantity) : 0,
    alertThreshold: p.stockItem?.alertThreshold ? Number(p.stockItem.alertThreshold) : null,
    recentMovements: (p.stockItem?.movements ?? []).map((m) => ({
      id:        m.id,
      type:      m.type,
      quantity:  Number(m.quantity),
      reason:    m.reason,
      createdAt: m.createdAt.toISOString(),
    })),
  }));

  return <EstoqueClient items={items} />;
}
