import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"];

// GET — histórico do cliente vinculado ao card: pedidos, NFs e boletos
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ROLES.includes(session.user.role)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const { tenantId } = session.user;

  const card = await prisma.crmCard.findFirst({
    where: { id, tenantId },
    select: {
      clientId: true,
      client: {
        select: {
          id: true, name: true, nomeFantasia: true, email: true, phone: true,
          cnpj: true, cpf: true, city: true, state: true, prazoBoletoDias: true,
        },
      },
    },
  });
  if (!card) return NextResponse.json({ error: "Card não encontrado" }, { status: 404 });

  if (!card.clientId) {
    return NextResponse.json({ client: null, orders: [] });
  }

  const orders = await prisma.order.findMany({
    where: { tenantId, clientId: card.clientId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      createdAt: true,
      scheduledDeliveryDate: true,
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          product: { select: { name: true, unit: true } },
        },
      },
      invoices: {
        select: { id: true, number: true, status: true, pdfUrl: true, focusNfeRef: true, issuedAt: true },
        orderBy: { createdAt: "desc" },
      },
      payments: {
        select: {
          id: true, amount: true, method: true, status: true, dueDate: true, paidAt: true,
          linhaDigitavel: true, boletoPdfUrl: true, itauNossoNumero: true,
        },
        orderBy: { dueDate: "asc" },
      },
    },
  });

  const mapped = orders.map((o) => {
    const total = o.items.reduce((s, it) => s + Number(it.quantity) * Number(it.unitPrice), 0);
    return {
      id: o.id,
      status: o.status,
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt.toISOString(),
      scheduledDeliveryDate: o.scheduledDeliveryDate ? o.scheduledDeliveryDate.toISOString() : null,
      total,
      items: o.items.map((it) => ({
        name: it.product?.name ?? "—",
        unit: it.product?.unit ?? null,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
      })),
      invoices: o.invoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        pdfUrl: inv.pdfUrl,
        focusNfeRef: inv.focusNfeRef,
        issuedAt: inv.issuedAt ? inv.issuedAt.toISOString() : null,
      })),
      payments: o.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        status: p.status,
        dueDate: p.dueDate.toISOString(),
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        linhaDigitavel: p.linhaDigitavel,
        boletoPdfUrl: p.boletoPdfUrl,
        itauNossoNumero: p.itauNossoNumero,
      })),
    };
  });

  return NextResponse.json({ client: card.client, orders: mapped });
}
