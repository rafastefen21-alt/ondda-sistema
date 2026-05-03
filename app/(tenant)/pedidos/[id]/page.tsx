import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { OrderDetailClient } from "./order-detail-client";
import { canSeePrice } from "@/lib/utils";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) notFound();

  const { tenantId, role, id: userId } = session.user;
  const isClient = role === "CLIENTE";

  const order = await prisma.order.findFirst({
    where: {
      id,
      tenantId,
      ...(isClient ? { clientId: userId } : {}),
    },
    include: {
      client: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, unit: true } },
        },
      },
      payments: { orderBy: { dueDate: "asc" } },
      invoices: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, number: true, status: true,
          pdfUrl: true, issuedAt: true,
          focusNfeRef: true, errorMsg: true,
        },
      },
    },
  });

  if (!order) notFound();

  const showPrice = canSeePrice(role, order.status);

  return (
    <OrderDetailClient
      order={{
        ...order,
        scheduledDeliveryDate: order.scheduledDeliveryDate ?? null,
        requestedDate: order.requestedDate ?? null,
        paymentMethod: order.paymentMethod ?? null,
        items: order.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
        payments: order.payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
        })),
      }}
      role={role}
      showPrice={showPrice}
    />
  );
}
