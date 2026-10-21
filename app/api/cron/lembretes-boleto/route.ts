/**
 * Lembretes de vencimento de boleto por WhatsApp.
 *
 *  GET  → chamado pelo cron da Vercel (vercel.json) uma vez por dia.
 *         Autentica com Authorization: Bearer ${CRON_SECRET}.
 *  POST → disparo manual pelo admin do tenant (Configurações → Mensagens).
 *         Body: { simular?: boolean } — simular só lista quem receberia.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { enviarLembretesTenant, enviarLembretesTodos } from "@/lib/lembretes-boleto";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const resumos = await enviarLembretesTodos();
  const enviados = resumos.reduce((s, r) => s + r.resultados.filter((x) => x.enviado).length, 0);
  const falhas   = resumos.reduce((s, r) => s + r.resultados.filter((x) => !x.enviado && x.modo !== "pulado").length, 0);
  console.log("[LEMBRETE-BOLETO] cron", { tenants: resumos.length, enviados, falhas });
  return NextResponse.json({ ok: true, enviados, falhas, resumos });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const simular = body?.simular !== false; // padrão: simula

  try {
    const resumo = await enviarLembretesTenant(session.user.tenantId, { simular, forcarAtivo: true });
    return NextResponse.json(resumo);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
