import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { tenantId } = session.user;

  const invoices = await prisma.invoice.findMany({
    where: { tenantId },
    include: {
      order: { include: { client: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    invoices.map((inv) => ({
      id:          inv.id,
      status:      inv.status,
      number:      inv.number ?? null,
      accessKey:   inv.accessKey ?? null,
      focusNfeRef: inv.focusNfeRef ?? null,
      pdfUrl:      inv.pdfUrl ?? null,
      issuedAt:    inv.issuedAt ? inv.issuedAt.toISOString() : null,
      createdAt:   inv.createdAt.toISOString(),
      errorMsg:    inv.errorMsg ?? null,
      orderId:     inv.orderId,
      clientName:  inv.order.client?.name ?? null,
    })),
  );
}
