/**
 * POST /api/pagamentos/{id}/reenviar-boleto
 *
 * Reenvia ao cliente um boleto já gerado, por e-mail (PDF anexado) e/ou
 * WhatsApp (linha digitável).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { reenviarBoletoPagamento } from "@/lib/cobranca-service";

export async function POST(
  _req: NextRequest,
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

  try {
    const canais = await reenviarBoletoPagamento(id, session.user.tenantId);
    return NextResponse.json({ ok: true, ...canais });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
