import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sendCartaCorrecao, fetchCartaCorrecao } from "@/lib/nfe";

// ── GET /api/nfe/{invoiceId}/carta-correcao ──────────────────────────────────
// Retorna os dados da CC-e (status, links XML e PDF)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId: session.user.tenantId },
  });
  if (!invoice?.focusNfeRef) {
    return NextResponse.json({ error: "NF-e não encontrada" }, { status: 404 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { focusNfeToken: true, nfeAmbiente: true },
  });
  if (!tenant?.focusNfeToken) {
    return NextResponse.json({ error: "Token não configurado" }, { status: 400 });
  }

  const { httpStatus, data } = await fetchCartaCorrecao(
    invoice.focusNfeRef,
    tenant.focusNfeToken,
    tenant.nfeAmbiente ?? "homologacao",
  );

  if (httpStatus >= 400) {
    return NextResponse.json({ error: "CC-e não encontrada", detail: data }, { status: 404 });
  }

  return NextResponse.json({
    status:      data.status,
    sequencia:   data.sequencia,
    data_evento: data.data_evento,
    correcao:    data.correcao ?? data.descricao_evento,
    xmlUrl:      data.caminho_xml_carta_correcao ? `/api/nfe/${invoiceId}/carta-correcao/xml` : null,
    pdfUrl:      data.caminho_pdf_carta_correcao ? `/api/nfe/${invoiceId}/carta-correcao/pdf` : null,
  });
}

// ── POST /api/nfe/{invoiceId}/carta-correcao ─────────────────────────────────
// Envia CC-e para a SEFAZ via Focus NF-e
const schema = z.object({
  texto:     z.string().min(15).max(1000),
  sequencia: z.number().int().min(1).max(20).default(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId: session.user.tenantId },
  });
  if (!invoice) {
    return NextResponse.json({ error: "NF-e não encontrada" }, { status: 404 });
  }
  if (invoice.status !== "EMITIDA" || !invoice.focusNfeRef) {
    return NextResponse.json({ error: "CC-e só pode ser enviada em NF-e autorizada" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { focusNfeToken: true, nfeAmbiente: true },
  });
  if (!tenant?.focusNfeToken) {
    return NextResponse.json({ error: "Token Focus NF-e não configurado" }, { status: 400 });
  }

  const { httpStatus, data } = await sendCartaCorrecao(
    invoice.focusNfeRef,
    parsed.data.texto,
    parsed.data.sequencia,
    tenant.focusNfeToken,
    tenant.nfeAmbiente ?? "homologacao",
  );

  if (httpStatus >= 400) {
    return NextResponse.json(
      { error: data?.erros?.[0]?.mensagem ?? data?.mensagem ?? "Erro ao enviar CC-e", detail: data },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    xmlUrl: `/api/nfe/${invoiceId}/carta-correcao/xml`,
    pdfUrl: `/api/nfe/${invoiceId}/carta-correcao/pdf`,
  });
}
