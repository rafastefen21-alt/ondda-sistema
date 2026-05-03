import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PedidosClient } from "./pedidos-client";

export default async function PedidosPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role, id: userId } = session.user;
  const isClient = role === "CLIENTE";

  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      ...(isClient ? { clientId: userId } : {}),
      // Exclude draft and cancelled from main view
      status: { notIn: ["RASCUNHO", "CANCELADO"] },
    },
    include: {
      client: { select: { name: true } },
      items: {
        include: { product: { select: { name: true, unit: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <PedidosClient
      initialOrders={orders.map((o) => ({
        id: o.id,
        status: o.status as never,
        createdAt: o.createdAt.toISOString(),
        scheduledDeliveryDate: o.scheduledDeliveryDate?.toISOString() ?? null,
        client: o.client ?? null,
        items: o.items.map((i) => ({
          product: { name: i.product.name, unit: i.product.unit },
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
        })),
      }))}
      role={role}
      isClient={isClient}
    />
  );
}
