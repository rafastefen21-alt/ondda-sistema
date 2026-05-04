import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelNfe } from "@/lib/nfe";

// ─── POST /api/pedidos/[id]/cancelar-nfe ─────────────────────────────────────
// Cancela a NF-e emitida via Focus NF-e e marca o registro como CANCELADA.
// Body: { invoiceId: string, justificativa: string (min 15 chars) }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params;
  const session = await auth();

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { tenantId } = session.user;
  const body = await req.json().catch(() => ({}));
  const { invoiceId, justificativa } = body as { invoiceId?: string; justificativa?: string };

  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId é obrigatório." }, { status: 400 });
  }

  const just = (justificativa ?? "").trim();
  if (just.length < 15) {
    return NextResponse.json(
      { error: "A justificativa deve ter pelo menos 15 caracteres." },
      { status: 400 },
    );
  }

  // ── Valida invoice ────────────────────────────────────────────────────────
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, orderId, tenantId },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Nota fiscal não encontrada." }, { status: 404 });
  }
  if (invoice.status !== "EMITIDA") {
    return NextResponse.json(
      { error: "Somente NF-e com status EMITIDA pode ser cancelada." },
      { status: 400 },
    );
  }
  if (!invoice.focusNfeRef) {
    return NextResponse.json(
      { error: "Referência Focus NF-e não encontrada." },
      { status: 400 },
    );
  }

  // ── Busca credenciais ─────────────────────────────────────────────────────
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { focusNfeToken: true, nfeAmbiente: true },
  });

  if (!tenant?.focusNfeToken) {
    return NextResponse.json(
      { error: "Token Focus NF-e não configurado. Acesse Configurações → Integrações." },
      { status: 400 },
    );
  }

  const ambiente = tenant.nfeAmbiente ?? "homologacao";

  // ── Chama Focus NF-e ──────────────────────────────────────────────────────
  const { httpStatus, data } = await cancelNfe(
    invoice.focusNfeRef,
    just,
    tenant.focusNfeToken,
    ambiente,
  );

  if (httpStatus >= 400) {
    // Mensagem de erro da Focus se disponível
    const focusMsg = data?.mensagem ?? data?.erros?.[0]?.mensagem ?? JSON.stringify(data);
    return NextResponse.json(
      { error: `Erro ao cancelar na Focus NF-e: ${focusMsg}` },
      { status: 502 },
    );
  }

  // ── Atualiza registro ─────────────────────────────────────────────────────
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: "CANCELADA", errorMsg: null },
  });

  return NextResponse.json({ invoice: updated });
}
