import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { status, paidAt } = body;

  if (!["PAGO", "PENDENTE", "VENCIDO", "CANCELADO"].includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const payment = await prisma.payment.update({
    where: { id, tenantId: session.user.tenantId },
    data: {
      status,
      paidAt: status === "PAGO" ? (paidAt ? new Date(paidAt) : new Date()) : null,
    },
  });

  return NextResponse.json(payment);
}
