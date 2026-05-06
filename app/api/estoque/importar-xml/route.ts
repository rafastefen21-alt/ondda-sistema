import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adjustStock } from "@/lib/stock";
import { XMLParser } from "fast-xml-parser";

// POST /api/estoque/importar-xml
// Recebe um arquivo XML de NF-e, extrai os itens e dá entrada no estoque
// dos produtos que tiverem NCM correspondente cadastrado.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { tenantId } = session.user;

  // Lê o XML via multipart
  const formData = await req.formData();
  const file = formData.get("xml") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Arquivo XML não enviado." }, { status: 400 });
  }

  const xmlText = await file.text();

  // Parseia o XML da NF-e
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xmlText);
  } catch {
    return NextResponse.json({ error: "XML inválido ou corrompido." }, { status: 400 });
  }

  // Navega pela estrutura do NF-e (com ou sem wrapper nfeProc)
  const nfe =
    (parsed?.nfeProc as Record<string, unknown>)?.NFe ??
    (parsed?.NFe as Record<string, unknown>) ??
    null;

  const infNFe = (nfe as Record<string, unknown>)?.infNFe as Record<string, unknown> | null;
  if (!infNFe) {
    return NextResponse.json({ error: "Estrutura de NF-e não encontrada no XML." }, { status: 400 });
  }

  // det pode ser array (múltiplos itens) ou objeto (único item)
  const detRaw = infNFe.det;
  const dets: Record<string, unknown>[] = Array.isArray(detRaw)
    ? detRaw
    : detRaw
    ? [detRaw as Record<string, unknown>]
    : [];

  if (dets.length === 0) {
    return NextResponse.json({ error: "Nenhum item encontrado no XML." }, { status: 400 });
  }

  // Coleta todos os NCMs presentes no XML
  const ncmSet = new Set(
    dets.map((d) => {
      const prod = d.prod as Record<string, unknown>;
      return String(prod?.NCM ?? "").replace(/\D/g, "");
    }).filter(Boolean),
  );

  // Busca produtos do tenant que tenham esses NCMs
  const products = await prisma.product.findMany({
    where: { tenantId, active: true, ncm: { in: [...ncmSet] } },
  });

  const productByNcm = new Map(products.map((p) => [p.ncm?.replace(/\D/g, "") ?? "", p]));

  const results: {
    nItem:     number;
    xProd:     string;
    ncm:       string;
    quantity:  number;
    status:    "importado" | "nao_mapeado" | "multiplos";
    productId?: string;
    productName?: string;
  }[] = [];

  for (const det of dets) {
    const prod     = det.prod as Record<string, unknown>;
    const nItem    = Number((det as Record<string, unknown>)["@_nItem"] ?? 0);
    const xProd    = String(prod?.xProd ?? "");
    const ncm      = String(prod?.NCM ?? "").replace(/\D/g, "");
    const quantity = parseFloat(String(prod?.qCom ?? "0").replace(",", "."));

    const product = productByNcm.get(ncm);

    if (!product) {
      results.push({ nItem, xProd, ncm, quantity, status: "nao_mapeado" });
      continue;
    }

    await adjustStock({
      tenantId,
      productId: product.id,
      delta:     quantity,
      type:      "ENTRADA",
      reason:    `Importação XML NF-e — ${xProd}`,
    });

    results.push({
      nItem,
      xProd,
      ncm,
      quantity,
      status:      "importado",
      productId:   product.id,
      productName: product.name,
    });
  }

  const imported    = results.filter((r) => r.status === "importado").length;
  const notMapped   = results.filter((r) => r.status === "nao_mapeado").length;

  return NextResponse.json({ imported, notMapped, results });
}
