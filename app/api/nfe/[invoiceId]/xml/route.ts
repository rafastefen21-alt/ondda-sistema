import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FOCUS_BASE: Record<string, string> = {
  homologacao: "https://homologacao.focusnfe.com.br/v2",
  producao:    "https://api.focusnfe.com.br/v2",
};

/**
 * GET /api/nfe/[invoiceId]/xml
 *
 * Proxy que busca o XML da NF-e na Focus NF-e (autenticação HTTP Basic)
 * e o entrega como download para o browser.
 *
 * Nunca expõe o token ao cliente.
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

  // Busca a invoice garantindo que pertence ao tenant
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    select: { focusNfeRef: true, xmlUrl: true, accessKey: true, number: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "NF-e não encontrada" }, { status: 404 });
  }

  // Busca o token e ambiente do tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { focusNfeToken: true, nfeAmbiente: true },
  });

  if (!tenant?.focusNfeToken) {
    return NextResponse.json({ error: "Token Focus NF-e não configurado" }, { status: 400 });
  }

  const base   = FOCUS_BASE[tenant.nfeAmbiente ?? "homologacao"] ?? FOCUS_BASE.homologacao;
  const auth64 = Buffer.from(`${tenant.focusNfeToken}:`).toString("base64");

  // Monta URL do XML:
  // 1) xmlUrl salvo no banco (caminho relativo /arquivos/... ou URL absoluta)
  // 2) Fallback: endpoint /v2/nfe/{ref}/xml
  let url: string;
  if (invoice.xmlUrl) {
    url = invoice.xmlUrl.startsWith("http")
      ? invoice.xmlUrl
      : `${base}${invoice.xmlUrl}`;
  } else if (invoice.focusNfeRef) {
    url = `${base}/v2/nfe/${invoice.focusNfeRef}/xml`;
  } else {
    return NextResponse.json({ error: "XML não disponível para esta NF-e" }, { status: 404 });
  }

  console.log("[xml-proxy] fetching", url, "ambiente:", tenant.nfeAmbiente);

  const focusRes = await fetch(url, {
    headers: { Authorization: `Basic ${auth64}` },
  });

  if (!focusRes.ok) {
    const body = await focusRes.text().catch(() => "");
    console.error("[xml-proxy] Focus error", focusRes.status, body);
    const msg = body || `Focus NF-e retornou status ${focusRes.status}`;
    return NextResponse.json({ error: msg }, { status: focusRes.status });
  }

  const xmlText = await focusRes.text();

  // Nome do arquivo: NFe{chave}.xml ou NF-{número}.xml
  const chave    = invoice.accessKey?.replace(/\D/g, "") ?? "";
  const fileName = chave
    ? `NFe${chave}.xml`
    : `NF-${invoice.number ?? invoiceId}.xml`;

  return new NextResponse(xmlText, {
    status: 200,
    headers: {
      "Content-Type":        "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control":       "no-store",
    },
  });
}
