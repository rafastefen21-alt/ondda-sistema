/**
 * GET /api/relatorios/produtos/pdf?de=YYYY-MM-DD&ate=YYYY-MM-DD
 * PDF do relatório de pedidos e faturamento por produto.
 */
import { NextRequest } from "next/server";
import { relatorioProdutos } from "@/lib/relatorios";
import { renderRelatorioProdutosPdf } from "@/lib/relatorios-pdf";
import { responderPdfRelatorio } from "@/lib/relatorios-http";

export async function GET(req: NextRequest) {
  return responderPdfRelatorio(req, "produtos", async (tenantId, periodo, tenant) =>
    renderRelatorioProdutosPdf(await relatorioProdutos(tenantId, periodo), tenant));
}
