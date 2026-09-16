/**
 * Conciliação de boletos Itaú (admin).
 *
 *  POST { acao: "consultar", nossoNumeros: ["00000337", ...] }
 *    → situação de cada boleto no Itaú (EM ABERTO / PAGO / BAIXADO / não encontrado)
 *  POST { acao: "baixar", nossoNumeros: [...] }
 *    → baixa (cancela) cada boleto no Itaú. Só em ambiente Efetivação.
 *
 * Serve para limpar boletos que ficaram "órfãos" no banco: emitidos pelo
 * sistema e depois substituídos (reemissão) ou de pedidos cancelados, cujo
 * Nosso Número já não consta em nenhum pagamento.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { baixarBoleto, carregarCredenciaisItau, consultarBoleto } from "@/lib/itau";

export const maxDuration = 60;

const MAX_POR_CHAMADA = 40;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const { tenantId } = session.user;

  const body = await req.json().catch(() => ({}));
  const acao = body?.acao as string | undefined;
  const brutos: unknown[] = Array.isArray(body?.nossoNumeros) ? body.nossoNumeros : [];
  const nossoNumeros = [...new Set(
    brutos
      .map((v) => String(v ?? "").replace(/\D/g, ""))
      .filter((v) => v.length > 0 && v.length <= 8)
      .map((v) => v.padStart(8, "0")),
  )];

  if (acao !== "consultar" && acao !== "baixar") {
    return NextResponse.json({ error: "Ação inválida (consultar | baixar)." }, { status: 400 });
  }
  if (nossoNumeros.length === 0) {
    return NextResponse.json({ error: "Informe ao menos um Nosso Número." }, { status: 400 });
  }
  if (nossoNumeros.length > MAX_POR_CHAMADA) {
    return NextResponse.json(
      { error: `No máximo ${MAX_POR_CHAMADA} números por vez.` },
      { status: 400 },
    );
  }

  const cred = await carregarCredenciaisItau(tenantId);
  if (!cred) {
    return NextResponse.json(
      { error: "Configure as credenciais do Itaú antes de conciliar boletos." },
      { status: 400 },
    );
  }
  if (acao === "baixar" && cred.ambiente !== "Efetivacao") {
    return NextResponse.json(
      { error: "A baixa só faz sentido em ambiente de Efetivação (produção)." },
      { status: 400 },
    );
  }

  // Cruza com o banco: qual pagamento (se algum) ainda aponta para cada número.
  const pagamentos = await prisma.payment.findMany({
    where: { tenantId, itauNossoNumero: { in: nossoNumeros } },
    select: {
      id: true, itauNossoNumero: true, status: true, amount: true,
      order: { select: { id: true, status: true, client: { select: { name: true } } } },
    },
  });
  const porNn = new Map(pagamentos.map((p) => [p.itauNossoNumero!, p]));

  const resultados: Array<Record<string, unknown>> = [];
  for (const nn of nossoNumeros) {
    const pag = porNn.get(nn);
    const vinculo = pag
      ? {
          paymentId: pag.id, pagamentoStatus: pag.status, valor: Number(pag.amount),
          orderId: pag.order.id, pedidoStatus: pag.order.status, cliente: pag.order.client.name,
        }
      : null;

    try {
      if (acao === "consultar") {
        const s = await consultarBoleto({ tenantId, credenciais: cred, nossoNumero: nn });
        resultados.push({ ...s, vinculo });
        continue;
      }

      // baixar — protege boletos que ainda são a cobrança ativa de um pedido vivo
      if (pag && pag.status === "PAGO") {
        resultados.push({ nossoNumero: nn, ok: false, pulado: true, mensagem: "Pagamento já está PAGO no sistema.", vinculo });
        continue;
      }
      if (pag && pag.status !== "CANCELADO" && pag.order.status !== "CANCELADO" && !body?.forcar) {
        resultados.push({
          nossoNumero: nn, ok: false, pulado: true, vinculo,
          mensagem: "É o boleto ativo de um pedido em andamento. Use 'Reemitir' no pedido ou marque 'forçar'.",
        });
        continue;
      }

      const r = await baixarBoleto({ tenantId, credenciais: cred, nossoNumero: nn });
      if (r.ok && pag && pag.status !== "PAGO") {
        await prisma.payment.update({
          where: { id: pag.id },
          data: {
            status: "CANCELADO",
            notes: [
              (await prisma.payment.findUnique({ where: { id: pag.id }, select: { notes: true } }))?.notes?.trim(),
              `[${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}] Boleto NN ${nn} baixado no Itaú (conciliação manual por ${session.user.email ?? session.user.id}).`,
            ].filter(Boolean).join("\n"),
          },
        });
      }
      console.log("[ITAU-CONCILIACAO] baixa", { nn, status: r.status, ok: r.ok, por: session.user.id });
      resultados.push({ nossoNumero: nn, ok: r.ok, status: r.status, mensagem: r.mensagem, vinculo });
    } catch (e) {
      resultados.push({ nossoNumero: nn, ok: false, erro: (e as Error).message, vinculo });
    }
  }

  return NextResponse.json({ acao, ambiente: cred.ambiente, resultados });
}
