import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AprovacoesClient } from "./aprovacoes-client";
import type { Prisma } from "@/app/generated/prisma/client";

export default async function AprovacoesPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(role)) {
    redirect("/dashboard");
  }

  const orders = await prisma.order.findMany({
    where: { tenantId, status: "PENDENTE_APROVACAO" },
    include: {
      client: {
        select: {
          id: true, name: true, email: true,
          createdAt: true, active: true,
          _count: { select: { orders: true } },
        },
      },
      items: {
        include: { product: { select: { name: true, unit: true, price: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <AprovacoesClient
      orders={orders.map((o) => ({
        id: o.id,
        createdAt: o.createdAt,
        notes: o.notes,
        requestedDate: o.requestedDate,
        deliveryAddress: o.deliveryAddress,
        client: {
          id: o.client.id,
          name: o.client.name,
          email: o.client.email,
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
