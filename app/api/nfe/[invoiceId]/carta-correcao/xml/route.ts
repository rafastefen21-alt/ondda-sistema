import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchCartaCorrecao } from "@/lib/nfe";

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

  // Busca metadados da CC-e para obter o caminho real do arquivo
  const { httpStatus, data } = await fetchCartaCorrecao(
    invoice.focusNfeRef,
    tenant.focusNfeToken,
    tenant.nfeAmbiente ?? "homologacao",
  );

  // Retorna a resposta bruta temporariamente para diagnóstico
  if (httpStatus >= 400) {
    return NextResponse.json({ error: "Erro ao buscar CC-e", httpStatus, focusData: data }, { status: 404 });
  }
  if (!data.caminho_xml_carta_correcao) {
    return NextResponse.json({ error: "XML da CC-e não disponível", camposRecebidos: Object.keys(data), focusData: data }, { status: 404 });
  }

  // O caminho retornado pelo Focus é relativo sem /v2 (ex: /notas_fiscais/.../cartas_correcao/1.xml)
  // Base para arquivos é o host sem /v2
  const fileBase = (tenant.nfeAmbiente ?? "homologacao") === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
  const xmlPath = data.caminho_xml_carta_correcao as string;
  const xmlUrl  = xmlPath.startsWith("http") ? xmlPath : `${fileBase}${xmlPath}`;

  const fileRes = await fetch(xmlUrl, {
    headers: { Authorization: "Basic " + Buffer.from(`${tenant.focusNfeToken}:`).toString("base64") },
  });

  if (!fileRes.ok) {
    const body = await fileRes.text().catch(() => "");
    return NextResponse.json({ error: "Erro ao baixar XML da CC-e", xmlUrl, fileStatus: fileRes.status, fileBody: body.slice(0, 500) }, { status: 502 });
  }

  const nfe = invoice.number ? `NF-e-${invoice.number}` : invoice.focusNfeRef;

  return new NextResponse(fileRes.body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="CCe-${nfe}.xml"`,
    },
  });
}
