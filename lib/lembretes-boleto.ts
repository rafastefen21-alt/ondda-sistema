/**
 * Lembretes de vencimento de boleto por WhatsApp.
 *
 * Roda uma vez por dia (cron da Vercel → /api/cron/lembretes-boleto) e, para
 * cada tenant com WhatsApp configurado e lembretes ativos, envia o modelo
 * aprovado aos clientes cujos boletos vencem daqui a N dias (ex.: 7 e 2).
 *
 * Idempotente: cada envio fica registrado em Payment.lembretesEnviados
 * ({ "7": iso, "2": iso }), então rodar duas vezes no mesmo dia não repete.
 */
import { prisma } from "@/lib/prisma";
import { mergeNotificacoes } from "@/lib/notificacoes";
import { zapiSendTemplate, zapiSendText } from "@/lib/zapi";

const TZ = "America/Sao_Paulo";

/** Data civil (YYYY-MM-DD) de um instante, no fuso de São Paulo. */
export function dataBr(d: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}

/** Soma dias a uma data civil YYYY-MM-DD. */
function somarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

const fmtBrl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (iso: string) => iso.split("-").reverse().join("/");

export interface ResultadoLembrete {
  paymentId:   string;
  orderId:     string;
  cliente:     string;
  telefone:    string | null;
  diasAntes:   number;
  vencimento:  string;
  valor:       number;
  enviado:     boolean;
  modo:        "template" | "texto" | "simulacao" | "pulado";
  erro?:       string;
}

export interface ResumoLembretes {
  tenantId:   string;
  tenant:     string;
  hoje:       string;
  ativo:      boolean;
  diasAntes:  number[];
  resultados: ResultadoLembrete[];
}

/**
 * Processa os lembretes de um tenant para a data de referência.
 * simular=true só lista quem receberia, sem enviar nem gravar.
 */
export async function enviarLembretesTenant(
  tenantId: string,
  opts: { hoje?: Date; simular?: boolean; forcarAtivo?: boolean } = {},
): Promise<ResumoLembretes> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, zapiInstanceId: true, zapiToken: true, notificacoes: true },
  });
  if (!tenant) throw new Error("Tenant não encontrado");

  const notif = mergeNotificacoes(tenant.notificacoes);
  const hoje = dataBr(opts.hoje ?? new Date());
  const ativo = notif.lembretes.ativo || !!opts.forcarAtivo;
  const resumo: ResumoLembretes = {
    tenantId, tenant: tenant.name.trim(), hoje, ativo,
    diasAntes: notif.lembretes.diasAntes, resultados: [],
  };
  if (!ativo || notif.lembretes.diasAntes.length === 0) return resumo;

  const waPronto = !!(tenant.zapiInstanceId && tenant.zapiToken);
  const cfg = { instanceId: tenant.zapiInstanceId ?? "", token: tenant.zapiToken ?? "" };

  // Janela de vencimentos que interessa (do menor ao maior "dias antes")
  const alvos = new Map<string, number>(); // vencimento → diasAntes
  for (const d of notif.lembretes.diasAntes) alvos.set(somarDias(hoje, d), d);
  const vencMin = new Date(`${[...alvos.keys()].sort()[0]}T00:00:00-03:00`);
  const vencMax = new Date(`${[...alvos.keys()].sort().at(-1)}T23:59:59-03:00`);

  const pagamentos = await prisma.payment.findMany({
    where: {
      tenantId, method: "BOLETO", status: "PENDENTE",
      itauNossoNumero: { not: null }, linhaDigitavel: { not: null },
      dueDate: { gte: vencMin, lte: vencMax },
      order: { status: { notIn: ["CANCELADO", "RASCUNHO"] } },
    },
    include: {
      order: {
        select: {
          id: true,
          client: { select: { name: true, nomeFantasia: true, phone: true, decisorPhone: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  for (const p of pagamentos) {
    const venc = dataBr(p.dueDate);
    const dias = alvos.get(venc);
    if (dias === undefined) continue;

    const enviados = (p.lembretesEnviados ?? {}) as Record<string, string>;
    const c = p.order.client;
    const nome = c.nomeFantasia ?? c.name ?? "cliente";
    const telefone = c.phone ?? c.decisorPhone ?? null;
    const base: ResultadoLembrete = {
      paymentId: p.id, orderId: p.order.id, cliente: nome, telefone, diasAntes: dias,
      vencimento: venc, valor: Number(p.amount), enviado: false, modo: "pulado",
    };

    if (enviados[String(dias)]) {
      resumo.resultados.push({ ...base, erro: `já enviado em ${enviados[String(dias)].slice(0, 10)}` });
      continue;
    }
    if (!telefone) {
      resumo.resultados.push({ ...base, erro: "cliente sem telefone" });
      continue;
    }
    if (opts.simular) {
      resumo.resultados.push({ ...base, modo: "simulacao" });
      continue;
    }
    if (!waPronto) {
      resumo.resultados.push({ ...base, erro: "WhatsApp (Datafy) não configurado" });
      continue;
    }

    const params = [
      nome,
      tenant.name.trim(),
      p.order.id.slice(-8).toUpperCase(),
      fmtBrl(Number(p.amount)),
      fmtData(venc),
      p.linhaDigitavel!,
    ];

    let r;
    let modo: ResultadoLembrete["modo"];
    if (notif.lembretes.templateNome) {
      modo = "template";
      r = await zapiSendTemplate(cfg, telefone, {
        name: notif.lembretes.templateNome,
        language: notif.lembretes.templateIdioma || "pt_BR",
        bodyParams: params,
      });
    } else {
      // Sem modelo aprovado: texto livre (só chega se o cliente falou com a
      // empresa nas últimas 24h — limitação da Meta).
      modo = "texto";
      r = await zapiSendText(
        cfg, telefone,
        `Olá, ${nome}! Aqui é a ${tenant.name.trim()}. Passando para lembrar que o boleto do pedido ` +
        `#${params[2]}, no valor de ${params[3]}, vence em ${params[4]}.\n\nLinha digitável:\n${params[5]}\n\n` +
        `Se o pagamento já foi feito, por favor desconsidere esta mensagem.`,
      );
    }

    if (r.success) {
      await prisma.payment.update({
        where: { id: p.id },
        data: { lembretesEnviados: { ...enviados, [String(dias)]: new Date().toISOString() } },
      });
      console.log("[LEMBRETE-BOLETO] enviado", { paymentId: p.id, dias, modo });
      resumo.resultados.push({ ...base, enviado: true, modo });
    } else {
      console.error("[LEMBRETE-BOLETO] falhou", { paymentId: p.id, dias, modo, erro: r.error });
      resumo.resultados.push({ ...base, modo, erro: r.error ?? "falha no envio" });
    }
  }

  return resumo;
}

/** Roda para todos os tenants com WhatsApp configurado. */
export async function enviarLembretesTodos(opts: { hoje?: Date } = {}): Promise<ResumoLembretes[]> {
  const tenants = await prisma.tenant.findMany({
    where: { zapiInstanceId: { not: null }, zapiToken: { not: null } },
    select: { id: true },
  });
  const out: ResumoLembretes[] = [];
  for (const t of tenants) {
    try {
      out.push(await enviarLembretesTenant(t.id, opts));
    } catch (e) {
      console.error("[LEMBRETE-BOLETO] erro no tenant", t.id, e);
    }
  }
  return out;
}
