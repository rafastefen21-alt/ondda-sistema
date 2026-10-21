/**
 * Modelo de mensagem do WhatsApp (Meta) usado nos lembretes de boleto.
 *
 *  GET  → situação do modelo configurado (APPROVED / PENDING / REJECTED...)
 *  POST → cadastra (submete para aprovação) o modelo padrão, se ainda não existir.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mergeNotificacoes, LEMBRETE_TEMPLATE_CORPO } from "@/lib/notificacoes";

const BASE = "https://cloud.datafyapi.com.br";

async function contexto() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { erro: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { zapiToken: true, notificacoes: true },
  });
  if (!tenant?.zapiToken) {
    return { erro: NextResponse.json({ error: "WhatsApp (Datafy) não configurado." }, { status: 400 }) };
  }
  const notif = mergeNotificacoes(tenant.notificacoes);
  const headers = { Authorization: `Bearer ${tenant.zapiToken}`, "Content-Type": "application/json" };

  const me = await fetch(`${BASE}/me`, { headers }).then((r) => r.json()).catch(() => null);
  const wabaId = me?.waba_id as string | undefined;
  if (!wabaId) {
    return { erro: NextResponse.json({ error: "Não foi possível obter a conta (waba_id) na Datafy." }, { status: 502 }) };
  }
  return { headers, wabaId, nome: notif.lembretes.templateNome, idioma: notif.lembretes.templateIdioma || "pt_BR" };
}

interface TemplateMeta {
  id?: string; name?: string; language?: string; status?: string; category?: string;
  rejected_reason?: string; components?: Array<{ type?: string; text?: string }>;
}

async function buscar(ctx: { headers: Record<string, string>; wabaId: string; nome: string; idioma: string }) {
  const res = await fetch(
    `${BASE}/v1/${ctx.wabaId}/message_templates?name=${encodeURIComponent(ctx.nome)}&limit=20`,
    { headers: { Authorization: ctx.headers.Authorization } },
  );
  const data = await res.json().catch(() => ({}));
  const lista: TemplateMeta[] = Array.isArray(data?.data) ? data.data : [];
  return lista.find((t) => t.name === ctx.nome && t.language === ctx.idioma) ?? lista.find((t) => t.name === ctx.nome) ?? null;
}

export async function GET() {
  const ctx = await contexto();
  if ("erro" in ctx) return ctx.erro;
  try {
    const t = await buscar(ctx);
    return NextResponse.json({
      nome: ctx.nome, idioma: ctx.idioma, existe: !!t,
      status: t?.status ?? null, categoria: t?.category ?? null, motivoRecusa: t?.rejected_reason ?? null,
      corpo: t?.components?.find((c) => c.type === "BODY")?.text ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function POST() {
  const ctx = await contexto();
  if ("erro" in ctx) return ctx.erro;
  try {
    const existente = await buscar(ctx);
    if (existente) {
      return NextResponse.json({ ok: true, jaExistia: true, status: existente.status ?? null });
    }
    const res = await fetch(`${BASE}/v1/${ctx.wabaId}/message_templates`, {
      method: "POST",
      headers: ctx.headers,
      body: JSON.stringify({
        name: ctx.nome,
        language: ctx.idioma,
        category: "UTILITY",
        parameter_format: "POSITIONAL",
        components: [{
          type: "BODY",
          text: LEMBRETE_TEMPLATE_CORPO,
          example: {
            body_text: [[
              "Padaria São José", "Casa do Pão SP", "A1B2C3D4", "R$ 528,00", "28/10/2026",
              "34191.09008 00000.123456 78901.234567 8 12340000052800",
            ]],
          },
        }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message ?? data?.message ?? `HTTP ${res.status}`;
      return NextResponse.json({ error: `A Meta recusou o cadastro: ${msg}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, jaExistia: false, status: data?.status ?? "PENDING", id: data?.id ?? null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
