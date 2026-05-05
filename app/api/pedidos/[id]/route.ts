import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { OrderStatus } from "@/app/generated/prisma/client";
import { sendOrderStatusEmail } from "@/lib/email";

const updateStatusSchema = z.object({
  status: z.enum([
    "RASCUNHO",
    "PENDENTE_APROVACAO",
    "APROVADO",
    "EM_PRODUCAO",
    "PRONTO",
    "EM_ENTREGA",
    "ENTREGUE",
    "CANCELADO",
  ]).optional(),
  internalNotes: z.string().optional(),
  cancelReason: z.string().optional(),
  scheduledDeliveryDate: z.string().optional().nullable(),
});

// Status transition rules — allows skipping stages forward (for kanban drag)
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RASCUNHO: ["PENDENTE_APROVACAO", "CANCELADO"],
  PENDENTE_APROVACAO: ["APROVADO", "CANCELADO"],
  APROVADO: ["EM_PRODUCAO", "PRONTO", "EM_ENTREGA", "ENTREGUE", "CANCELADO"],
  EM_PRODUCAO: ["PRONTO", "EM_ENTREGA", "ENTREGUE", "CANCELADO"],
  PRONTO: ["EM_ENTREGA", "ENTREGUE", "CANCELADO"],
  EM_ENTREGA: ["ENTREGUE", "CANCELADO"],
  ENTREGUE: [],
  CANCELADO: [],
};

// Who can transition to which statuses
const ROLE_STATUS_PERMISSIONS: Record<string, OrderStatus[]> = {
  SUPER_ADMIN: [
    "RASCUNHO",
    "PENDENTE_APROVACAO",
    "APROVADO",
    "EM_PRODUCAO",
    "PRONTO",
    "EM_ENTREGA",
    "ENTREGUE",
    "CANCELADO",
  ],
  TENANT_ADMIN: [
    "RASCUNHO",
    "PENDENTE_APROVACAO",
    "APROVADO",
    "EM_PRODUCAO",
    "PRONTO",
    "EM_ENTREGA",
    "ENTREGUE",
    "CANCELADO",
  ],
  GERENTE: ["APROVADO", "CANCELADO"],
  OPERADOR: ["EM_PRODUCAO", "PRONTO", "EM_ENTREGA", "ENTREGUE"],
  CLIENTE: ["PENDENTE_APROVACAO", "CANCELADO"],
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = await prisma.order.findFirst({
    where: {
      id,
      tenantId: session.user.tenantId,
      ...(session.user.role === "CLIENTE"
        ? { clientId: session.user.id }
        : {}),
    },
    include: {
      client: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { name: true } },
      items: {
        include: {
          product: {
            select: { name: true, unit: true, imageUrl: true },
          },
        },
      },
      payments: { orderBy: { dueDate: "asc" } },
      invoices: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(order);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: {
      id,
      tenantId: session.user.tenantId,
      ...(session.user.role === "CLIENTE"
        ? { clientId: session.user.id }
        : {}),
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const currentStatus = order.status as OrderStatus;
  const updateData: Record<string, unknown> = {};

  // If only updating scheduledDeliveryDate (no status change)
  if (!parsed.data.status) {
    const canEdit = ["TENANT_ADMIN", "SUPER_ADMIN", "GERENTE"].includes(session.user.role);
    if (!canEdit) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
    if ("scheduledDeliveryDate" in parsed.data) {
      updateData.scheduledDeliveryDate = parsed.data.scheduledDeliveryDate
        ? new Date(parsed.data.scheduledDeliveryDate)
        : null;
    }
  } else {
    const newStatus = parsed.data.status as OrderStatus;

    // Validate transition
    if (!ALLOWED_TRANSITIONS[currentStatus].includes(newStatus)) {
      return NextResponse.json(
        { error: `Transição de ${currentStatus} para ${newStatus} não permitida` },
        { status: 400 }
      );
    }

    // Validate role permission
    const rolePerms = ROLE_STATUS_PERMISSIONS[session.user.role] ?? [];
    if (!rolePerms.includes(newStatus)) {
      return NextResponse.json(
        { error: "Sem permissão para esta ação" },
        { status: 403 }
      );
    }

    updateData.status = newStatus;

    if (parsed.data.internalNotes) updateData.internalNotes = parsed.data.internalNotes;
    if (parsed.data.cancelReason) updateData.cancelReason = parsed.data.cancelReason;

    if (newStatus === "APROVADO") {
      updateData.approvedAt = new Date();
      updateData.approvedById = session.user.id;
      if (parsed.data.scheduledDeliveryDate) {
        updateData.scheduledDeliveryDate = new Date(parsed.data.scheduledDeliveryDate);
      }
    }
    if (newStatus === "ENTREGUE") updateData.deliveredAt = new Date();
    if (newStatus === "CANCELADO") updateData.cancelledAt = new Date();
  }

  const updated = await prisma.order.update({
    where: { id },
    data: updateData,
    include: {
      items: { include: { product: { select: { name: true, unit: true } } } },
      client: {
        select: {
          name: true, email: true,
          decisorEmail: true, decisorNome: true,
        },
      },
      tenant: { select: { name: true } },
    },
  });

  // ── Envia e-mail de notificação se houve mudança de status ────────────────
  if (parsed.data.status) {
    const { client, tenant } = updated;

    // Destinatários: decisorEmail (principal) + email do cliente (fallback/cópia)
    const recipients = [client.decisorEmail, client.email].filter(Boolean) as string[];
    // Remove duplicatas caso sejam iguais
    const uniqueRecipients = [...new Set(recipients)];

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    // Fire-and-forget — não bloqueia a resposta
    sendOrderStatusEmail(uniqueRecipients, {
      orderId:   updated.id,
      status:    parsed.data.status,
      tenantName: tenant.name,
      clientName: client.decisorNome ?? client.name ?? client.email,
      items: updated.items.map((i) => ({
        productName: i.product.name,
        quantity:    Number(i.quantity),
        unit:        i.product.unit,
        unitPrice:   Number(i.unitPrice),
      })),
      scheduledDeliveryDate: updated.scheduledDeliveryDate,
      appUrl,
    }).catch((err) => console.error("[EMAIL] falha silenciosa:", err));
  }

  return NextResponse.json(updated);
}
