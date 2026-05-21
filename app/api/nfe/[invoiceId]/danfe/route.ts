import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FOCUS_BASE: Record<string, string> = {
  homologacao: "https://homologacao.focusnfe.com.br",
  producao:    "https://api.focusnfe.com.br",
};

/**
 * GET /api/nfe/[invoiceId]/danfe
 *
 * Proxy que busca o DANFe (PDF) da NF-e na Focus NF-e com autenticação HTTP Basic
 * e entrega ao browser como download.
 *
 * A Focus retorna `caminho_danfe` como path relativo (ex: /danfe/NFe123.pdf),
 * então precisamos montar a URL completa com o token do tenant.
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
    select: { pdfUrl: true, focusNfeRef: true, accessKey: true, number: true },
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

  const base    = FOCUS_BASE[tenant.nfeAmbiente ?? "homologacao"] ?? FOCUS_BASE.homologacao;
  const auth64  = Buffer.from(`${tenant.focusNfeToken}:`).toString("base64");

  // Monta a URL do DANFe:
  // 1) Se temos o pdfUrl salvo (caminho relativo ou absoluto), usa ele
  // 2) Fallback: endpoint da API Focus /v2/nfe/{ref}/danfe
  let url: string;
  if (invoice.pdfUrl) {
    // Se começa com "/" é caminho relativo → prefixar base
    url = invoice.pdfUrl.startsWith("http")
      ? invoice.pdfUrl
      : `${base}${invoice.pdfUrl}`;
  } else if (invoice.focusNfeRef) {
    url = `${base}/v2/nfe/${invoice.focusNfeRef}/danfe`;
  } else {
    return NextResponse.json({ error: "URL do DANFe não disponível" }, { status: 404 });
  }

  console.log("[danfe-proxy] fetching", url);

  const focusRes = await fetch(url, {
    headers: { Authorization: `Basic ${auth64}` },
  });

  if (!focusRes.ok) {
    const body = await focusRes.text().catch(() => "");
    console.error("[danfe-proxy] Focus error", focusRes.status, body);
    return NextResponse.json(
      { error: `Focus NF-e retornou status ${focusRes.status}` },
      { status: focusRes.status },
    );
  }

  const buffer = await focusRes.arrayBuffer();

  const chave    = invoice.accessKey?.replace(/\D/g, "") ?? "";
  const fileName = chave
    ? `DANFe-${chave}.pdf`
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
