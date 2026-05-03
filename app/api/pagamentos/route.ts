import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const paymentSchema = z.object({
  orderId: z.string(),
  amount: z.number().positive(),
  method: z.enum([
    "PIX",
    "BOLETO",
    "CARTAO_CREDITO",
    "CARTAO_DEBITO",
    "DINHEIRO",
    "TRANSFERENCIA",
  ]),
  installments: z.number().int().min(1).max(12).default(1),
  dueDate: z.string(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Verify order belongs to tenant
  const order = await prisma.order.findFirst({
    where: { id: parsed.data.orderId, tenantId: session.user.tenantId },
  });
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  const baseDate = new Date(parsed.data.dueDate);
  const amountPerInstallment =
    parsed.data.amount / parsed.data.installments;

  // Create all installments
  const payments = await prisma.$transaction(
    Array.from({ length: parsed.data.installments }, (_, i) => {
      const dueDate = new Date(baseDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      return prisma.payment.create({
        data: {
          tenantId: session.user.tenantId!,
          orderId: parsed.data.orderId,
          amount: amountPerInstallment,
          method: parsed.data.method,
          installments: parsed.data.installments,
          installmentN: i + 1,
          dueDate,
          notes: parsed.data.notes,
          status: "PENDENTE",
        },
      });
    })
  );

  return NextResponse.json(payments, { status: 201 });
}
