/**
 * Relatórios — pedidos e faturamento por cliente.
 *
 * Considera pedidos aprovados (APROVADO → ENTREGUE) cuja data de aprovação
 * (ou de criação, se não houver) cai no período. Cancelados, rascunhos e
 * pendentes de aprovação ficam de fora. Faturamento = soma dos itens do pedido.
 */
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/app/generated/prisma/client";

export const STATUS_FATURADOS: OrderStatus[] = [
  "APROVADO", "EM_PRODUCAO", "PRONTO", "EM_ENTREGA", "ENTREGUE",
];

export interface LinhaClienteRelatorio {
  clienteId:     string;
  cliente:       string;
  documento:     string | null;
  pedidos:       number;
  faturamento:   number;
  ticketMedio:   number;
  participacao:  number; // % do faturamento total
  recebido:      number;
  emAberto:      number;
  ultimoPedido:  string; // ISO
}

export interface RelatorioClientes {
  de:            string; // YYYY-MM-DD
  ate:           string;
  totalPedidos:  number;
  totalClientes: number;
  faturamento:   number;
  recebido:      number;
  emAberto:      number;
  ticketMedio:   number;
  linhas:        LinhaClienteRelatorio[];
}

/** Hoje (YYYY-MM-DD) no fuso de São Paulo. */
export function hojeBr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Normaliza o período; padrão = mês corrente até hoje. */
export function normalizarPeriodo(de?: string | null, ate?: string | null): { de: string; ate: string } {
  const hoje = hojeBr();
  const ini = de && ISO.test(de) ? de : `${hoje.slice(0, 7)}-01`;
  const fim = ate && ISO.test(ate) ? ate : hoje;
  return ini <= fim ? { de: ini, ate: fim } : { de: fim, ate: ini };
}

export interface LinhaProdutoRelatorio {
  produtoId:     string;
  produto:       string;
  categoria:     string | null;
  unidade:       string;
  quantidade:    number;  // total vendido (na unidade do item)
  pedidos:       number;  // pedidos distintos que tiveram o produto
  clientes:      number;  // clientes distintos que compraram
  faturamento:   number;
  precoMedio:    number;  // faturamento / quantidade
  participacao:  number;  // % do faturamento total
}

export interface RelatorioProdutos {
  de:            string;
  ate:           string;
  totalPedidos:  number;
  totalProdutos: number;
  faturamento:   number;
  quantidade:    number;
  linhas:        LinhaProdutoRelatorio[];
}

/** Intervalo [início, fim] do período no fuso de São Paulo. */
function limites(periodo: { de: string; ate: string }) {
  return {
    inicio: new Date(`${periodo.de}T00:00:00-03:00`),
    fim:    new Date(`${periodo.ate}T23:59:59.999-03:00`),
  };
}

/** Filtro de pedidos faturados no período (data de aprovação, ou criação). */
function wherePedidos(tenantId: string, periodo: { de: string; ate: string }) {
  const { inicio, fim } = limites(periodo);
  return {
    tenantId,
    status: { in: STATUS_FATURADOS },
    OR: [
      { approvedAt: { gte: inicio, lte: fim } },
      { approvedAt: null, createdAt: { gte: inicio, lte: fim } },
    ],
  };
}

export async function relatorioProdutos(
  tenantId: string,
  periodo: { de: string; ate: string },
): Promise<RelatorioProdutos> {
  const pedidos = await prisma.order.findMany({
    where: wherePedidos(tenantId, periodo),
    select: {
      id: true, clientId: true,
      items: {
        select: {
          quantity: true, unitPrice: true,
          product: { select: { id: true, name: true, unit: true, category: { select: { name: true } } } },
        },
      },
    },
  });

  type Acc = LinhaProdutoRelatorio & { _pedidos: Set<string>; _clientes: Set<string> };
  const mapa = new Map<string, Acc>();
  for (const p of pedidos) {
    for (const it of p.items) {
      const pr = it.product;
      const acc = mapa.get(pr.id) ?? {
        produtoId: pr.id, produto: pr.name.trim(), categoria: pr.category?.name ?? null,
        // Em vários produtos o campo "unit" guarda a quantidade por pacote ("6",
        // "120"), não um nome de unidade — nesse caso não exibe rótulo.
        unidade: /^\s*\d/.test(pr.unit ?? "") ? "" : (pr.unit || ""),
        quantidade: 0, pedidos: 0, clientes: 0,
        faturamento: 0, precoMedio: 0, participacao: 0,
        _pedidos: new Set<string>(), _clientes: new Set<string>(),
      };
      const q = Number(it.quantity);
      acc.quantidade  += q;
      acc.faturamento += q * Number(it.unitPrice);
      acc._pedidos.add(p.id);
      acc._clientes.add(p.clientId);
      mapa.set(pr.id, acc);
    }
  }

  const faturamento = [...mapa.values()].reduce((s, l) => s + l.faturamento, 0);
  const linhas: LinhaProdutoRelatorio[] = [...mapa.values()].map(({ _pedidos, _clientes, ...l }) => ({
    ...l,
    quantidade:   Math.round(l.quantidade * 1000) / 1000,
    faturamento:  Math.round(l.faturamento * 100) / 100,
    pedidos:      _pedidos.size,
    clientes:     _clientes.size,
    precoMedio:   l.quantidade ? l.faturamento / l.quantidade : 0,
    participacao: faturamento ? (l.faturamento / faturamento) * 100 : 0,
  }));
  linhas.sort((a, b) => b.faturamento - a.faturamento || b.quantidade - a.quantidade);

  return {
    de: periodo.de, ate: periodo.ate,
    totalPedidos: pedidos.length,
    totalProdutos: linhas.length,
    faturamento,
    quantidade: linhas.reduce((s, l) => s + l.quantidade, 0),
    linhas,
  };
}

export async function relatorioClientes(
  tenantId: string,
  periodo: { de: string; ate: string },
): Promise<RelatorioClientes> {
  const pedidos = await prisma.order.findMany({
    where: wherePedidos(tenantId, periodo),
    select: {
      id: true, approvedAt: true, createdAt: true,
      client: { select: { id: true, name: true, nomeFantasia: true, email: true, cnpj: true, cpf: true } },
      items:    { select: { quantity: true, unitPrice: true } },
      payments: { select: { status: true, amount: true } },
    },
  });

  const mapa = new Map<string, LinhaClienteRelatorio>();
  for (const p of pedidos) {
    const c = p.client;
    const total = p.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0);
    const recebido = p.payments.filter((x) => x.status === "PAGO").reduce((s, x) => s + Number(x.amount), 0);
    const emAberto = p.payments
      .filter((x) => x.status === "PENDENTE" || x.status === "VENCIDO")
      .reduce((s, x) => s + Number(x.amount), 0);
    const data = (p.approvedAt ?? p.createdAt).toISOString();

    const linha = mapa.get(c.id) ?? {
      clienteId: c.id,
      cliente: (c.nomeFantasia || c.name || c.email || "Sem nome").trim(),
      documento: c.cnpj || c.cpf || null,
      pedidos: 0, faturamento: 0, ticketMedio: 0, participacao: 0,
      recebido: 0, emAberto: 0, ultimoPedido: data,
    };
    linha.pedidos     += 1;
    linha.faturamento += total;
    linha.recebido    += recebido;
    linha.emAberto    += emAberto;
    if (data > linha.ultimoPedido) linha.ultimoPedido = data;
    mapa.set(c.id, linha);
  }

  const linhas = [...mapa.values()];
  const faturamento = linhas.reduce((s, l) => s + l.faturamento, 0);
  for (const l of linhas) {
    l.faturamento  = Math.round(l.faturamento * 100) / 100;
    l.ticketMedio  = l.pedidos ? l.faturamento / l.pedidos : 0;
    l.participacao = faturamento ? (l.faturamento / faturamento) * 100 : 0;
  }
  linhas.sort((a, b) => b.faturamento - a.faturamento || b.pedidos - a.pedidos);

  return {
    de: periodo.de,
    ate: periodo.ate,
    totalPedidos:  pedidos.length,
    totalClientes: linhas.length,
    faturamento,
    recebido: linhas.reduce((s, l) => s + l.recebido, 0),
    emAberto: linhas.reduce((s, l) => s + l.emAberto, 0),
    ticketMedio: pedidos.length ? faturamento / pedidos.length : 0,
    linhas,
  };
}
