import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AprovacoesClient } from "./aprovacoes-client";

export default async function AprovacoesPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(role)) {
    redirect("/dashboard");
  }

  const [pendingClients, orders] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: "CLIENTE", active: false },
      select: { id: true, name: true, nomeFantasia: true, email: true, phone: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      where: { tenantId, status: "PENDENTE_APROVACAO" },
      include: {
        client: {
          select: {
            id: true, name: true, nomeFantasia: true, email: true, phone: true,
            createdAt: true, active: true,
            _count: { select: { orders: true } },
          },
        },
        items: {
          include: { product: { select: { name: true, unit: true, price: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <AprovacoesClient
      pendingClients={pendingClients.map((c) => ({
        id: c.id,
        name: c.nomeFantasia ?? c.name,
        email: c.email,
        phone: c.phone ?? null,
        createdAt: c.createdAt,
      }))}
      orders={orders.map((o) => ({
        id: o.id,
        createdAt: o.createdAt,
        notes: o.notes,
        requestedDate: o.requestedDate,
        deliveryAddress: o.deliveryAddress,
        client: {
          id: o.client.id,
          name: o.client.nomeFantasia ?? o.client.name,
          email: o.client.email,
          phone: o.client.phone ?? null,
          createdAt: o.client.createdAt,
          active: o.client.active,
          totalOrders: o.client._count.orders,
        },
        items: o.items.map((item) => ({
          id: item.id,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          product: { name: item.product.name, unit: item.product.unit, price: Number(item.product.price) },
        })),
      }))}
    />
  );
}
