import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FOCUS_ROOT: Record<string, string> = {
  homologacao: "https://homologacao.focusnfe.com.br",
  producao:    "https://api.focusnfe.com.br",
};

/**
 * GET /api/nfe/[invoiceId]/xml
 *
 * Proxy que busca o XML da NF-e na Focus NF-e (autenticação HTTP Basic)
 * e entrega ao browser como download.
 *
 * Estratégia:
 * 1. Se xmlUrl estiver salvo no banco (caminho relativo /arquivos/...) → usa direto
 * 2. Se xmlUrl for nulo → consulta /v2/nfe/{ref} para obter caminho_xml e baixa
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
    select: { focusNfeRef: true, xmlUrl: true, accessKey: true, number: true },
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

  // ── Resolve o caminho do XML ──────────────────────────────────────────────────
  let xmlPath: string | null = invoice.xmlUrl ?? null;

  if (!xmlPath && invoice.focusNfeRef) {
    // Consulta a NF-e na Focus para obter o caminho do arquivo
    const infoUrl = `${root}/v2/nfe/${encodeURIComponent(invoice.focusNfeRef)}`;
    console.log("[xml-proxy] consultando NF-e:", infoUrl);
    const infoRes = await fetch(infoUrl, { headers });
    if (infoRes.ok) {
      const data = await infoRes.json().catch(() => ({}));
      // Focus pode retornar caminho_xml_nota_fiscal ou caminho_xml
      xmlPath = data.caminho_xml_nota_fiscal ?? data.caminho_xml ?? null;
      console.log("[xml-proxy] caminho obtido:", xmlPath, "| dados:", JSON.stringify(data).slice(0, 300));
    } else {
      const body = await infoRes.text().catch(() => "");
      console.error("[xml-proxy] erro ao consultar NF-e:", infoRes.status, body);
      return NextResponse.json({ error: body || `Focus retornou ${infoRes.status}` }, { status: infoRes.status });
    }
  }

  if (!xmlPath) {
    return NextResponse.json(
      { error: "XML não disponível. Aguarde a autorização da NF-e e tente novamente." },
      { status: 404 },
    );
  }

  // ── Baixa o arquivo XML ───────────────────────────────────────────────────────
  const fileUrl = xmlPath.startsWith("http") ? xmlPath : `${root}${xmlPath}`;
  console.log("[xml-proxy] baixando:", fileUrl);

  const fileRes = await fetch(fileUrl, { headers });
  if (!fileRes.ok) {
    const body = await fileRes.text().catch(() => "");
    console.error("[xml-proxy] erro ao baixar XML:", fileRes.status, body);
    return NextResponse.json({ error: body || `Erro ${fileRes.status} ao baixar XML` }, { status: fileRes.status });
  }

  const xmlText = await fileRes.text();
  const chave   = invoice.accessKey?.replace(/\D/g, "") ?? "";
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
