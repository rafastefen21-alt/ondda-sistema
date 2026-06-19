import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { EditarPedidoClient } from "./editar-pedido-client";

export default async function EditarPedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "SUPER_ADMIN", "GERENTE"].includes(role)) {
    redirect(`/pedidos/${id}`);
  }

  const [order, clients, products] = await Promise.all([
    prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
      },
    }),
    prisma.user.findMany({
      where: { tenantId, active: true },
      select: { id: true, name: true, nomeFantasia: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { tenantId, active: true },
      include: { category: { select: { name: true } } },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  if (!order) notFound();

  if (!["RASCUNHO", "PENDENTE_APROVACAO"].includes(order.status)) {
    redirect(`/pedidos/${id}`);
  }

  return (
    <EditarPedidoClient
      order={{
        id: order.id,
        status: order.status,
        clientId: order.clientId,
        paymentMethod: order.paymentMethod ?? null,
        requestedDate: order.requestedDate
          ? order.requestedDate.toISOString().slice(0, 10)
          : null,
        scheduledDeliveryDate: order.scheduledDeliveryDate
          ? order.scheduledDeliveryDate.toISOString().slice(0, 10)
          : null,
        deliveryAddress: (order as unknown as Record<string, unknown>).deliveryAddress as string | null ?? null,
        notes: order.notes ?? null,
        internalNotes: order.internalNotes ?? null,
        items: order.items.map((item) => ({
          productId: item.productId,
          quantity:  Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          notes:     item.notes ?? "",
        })),
      }}
      clients={clients.map((c) => ({
        id:    c.id,
        name:  c.nomeFantasia ?? c.name,
        email: c.email,
        role:  c.role,
      }))}
      products={products.map((p) => ({
        id:          p.id,
        name:        p.name,
        price:       Number(p.price),
        pricePacote: p.pricePacote ? Number(p.pricePacote) : null,
        priceCaixa:  p.priceCaixa  ? Number(p.priceCaixa)  : null,
        labelPacote: p.labelPacote ?? null,
        labelCaixa:  p.labelCaixa  ?? null,
        unit:        p.unit,
        category:    p.category?.name ?? null,
      }))}
      role={role}
    />
  );
}
