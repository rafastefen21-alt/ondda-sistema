import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NovoPedidoClient } from "./novo-pedido-client";

export default async function NovoPedidoPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "SUPER_ADMIN", "GERENTE"].includes(role)) {
    redirect("/pedidos");
  }

  const [clients, products] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, active: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { tenantId, active: true },
      include: { category: { select: { name: true } } },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  return (
    <NovoPedidoClient
      clients={clients.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        role: c.role,
      }))}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        unit: p.unit,
        category: p.category?.name ?? null,
      }))}
      role={role}
    />
  );
}
