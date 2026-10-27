/**
 * GET /api/relatorios/clientes/pdf?de=YYYY-MM-DD&ate=YYYY-MM-DD
 * PDF do relatório de pedidos e faturamento por cliente.
 */
import { NextRequest } from "next/server";
import { relatorioClientes } from "@/lib/relatorios";
import { renderRelatorioClientesPdf } from "@/lib/relatorios-pdf";
import { responderPdfRelatorio } from "@/lib/relatorios-http";

export async function GET(req: NextRequest) {
  return responderPdfRelatorio(req, "clientes", async (tenantId, periodo, tenant) =>
    renderRelatorioClientesPdf(await relatorioClientes(tenantId, periodo), tenant));
}
