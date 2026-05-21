import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FOCUS_ROOT: Record<string, string> = {
  homologacao: "https://homologacao.focusnfe.com.br",
  producao:    "https://api.focusnfe.com.br",
};

/**
 * GET /api/nfe/[invoiceId]/danfe
 *
 * Proxy que busca o DANFe (PDF) da NF-e na Focus NF-e (autenticação HTTP Basic)
 * e entrega ao browser como download.
 *
 * Estratégia:
 * 1. Se pdfUrl estiver salvo no banco (caminho relativo /danfe/...) → usa direto
 * 2. Se pdfUrl for nulo → consulta /v2/nfe/{ref} para obter caminho_danfe e baixa
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { invoiceId } = await params;
  const { tenantId } = session.user;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    select: { focusNfeRef: true, pdfUrl: true, accessKey: true, number: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "NF-e não encontrada" }, { status: 404 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { focusNfeToken: true, nfeAmbiente: true },
  });

  if (!tenant?.focusNfeToken) {
    return NextResponse.json({ error: "Token Focus NF-e não configurado" }, { status: 400 });
  }

  const root   = FOCUS_ROOT[tenant.nfeAmbiente ?? "homologacao"] ?? FOCUS_ROOT.homologacao;
  const auth64 = Buffer.from(`${tenant.focusNfeToken}:`).toString("base64");
  const headers = { Authorization: `Basic ${auth64}` };

  if (!invoice.focusNfeRef) {
    return NextResponse.json({ error: "Referência da NF-e não encontrada" }, { status: 404 });
  }

  // Endpoint correto da Focus para PDF do DANFe
  const fileUrl = `${root}/v2/nfe/${encodeURIComponent(invoice.focusNfeRef)}/danfe`;
  console.log("[danfe-proxy] baixando PDF:", fileUrl);

  const fileRes = await fetch(fileUrl, { headers, redirect: "follow" });
  if (!fileRes.ok) {
    const body = await fileRes.text().catch(() => "");
    console.error("[danfe-proxy] erro:", fileRes.status, body);
    return NextResponse.json({ error: body || `Erro ${fileRes.status} ao baixar DANFe` }, { status: fileRes.status });
  }

  const buffer  = await fileRes.arrayBuffer();
  const chave   = invoice.accessKey?.replace(/\D/g, "") ?? "";
  const fileName = chave
    ? `DANFe${chave}.pdf`
    : `DANFe-${invoice.number ?? invoiceId}.pdf`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control":       "no-store",
    },
  });
}
