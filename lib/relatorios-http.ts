/**
 * Autenticação + período + resposta PDF comuns às rotas de relatório.
 * Usado pelas rotas de PDF em app/api/relatorios (clientes e produtos).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizarPeriodo } from "@/lib/relatorios";

export async function responderPdfRelatorio(
  req: NextRequest,
  nome: string,
  gerar: (tenantId: string, periodo: { de: string; ate: string }, tenant: string) => Promise<Buffer>,
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const periodo = normalizarPeriodo(sp.get("de"), sp.get("ate"));
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId }, select: { name: true },
  });
  const pdf = await gerar(session.user.tenantId, periodo, tenant?.name ?? "");

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="relatorio-${nome}-${periodo.de}-a-${periodo.ate}.pdf"`,
    },
  });
}
