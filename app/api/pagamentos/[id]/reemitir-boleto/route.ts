/**
 * POST /api/pagamentos/{id}/reemitir-boleto
 *
 * Baixa o boleto atual no Itaú (produção) e gera um novo com a data de
 * vencimento informada. Usado para corrigir a data de um boleto já emitido.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { reemitirBoletoPagamento } from "@/lib/cobranca-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "SUPER_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const vencimento = typeof body?.vencimento === "string" ? body.vencimento : null;

  try {
    const boleto = await reemitirBoletoPagamento(id, session.user.tenantId, { vencimento });
    return NextResponse.json({ ok: true, ...boleto });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
