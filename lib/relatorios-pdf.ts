/**
 * PDFs dos relatórios (por cliente e por produto).
 */
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import type { RelatorioClientes, RelatorioProdutos } from "@/lib/relatorios";

const h = React.createElement;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const dataHoraBr = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

const AZUL = "#1e40af";
const CINZA = "#6b7280";
const BORDA = "#e5e7eb";

const s = StyleSheet.create({
  page:    { padding: 28, paddingBottom: 40, fontFamily: "Helvetica", fontSize: 8, color: "#111827" },
  head:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 2, borderColor: AZUL, paddingBottom: 6, marginBottom: 10 },
  titulo:  { fontSize: 15, fontFamily: "Helvetica-Bold", color: AZUL },
  sub:     { fontSize: 9, color: CINZA, marginTop: 2 },
  cards:   { flexDirection: "row", gap: 6, marginBottom: 12 },
  card:    { flex: 1, borderWidth: 1, borderColor: BORDA, borderRadius: 4, padding: 6 },
  cardLbl: { fontSize: 7, color: CINZA },
  cardVal: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 },
  thRow:   { flexDirection: "row", backgroundColor: AZUL, color: "#fff", paddingVertical: 4, fontFamily: "Helvetica-Bold" },
  row:     { flexDirection: "row", paddingVertical: 3.5, borderBottomWidth: 0.5, borderColor: BORDA },
  rowAlt:  { backgroundColor: "#f9fafb" },
  totRow:  { flexDirection: "row", paddingVertical: 4, borderTopWidth: 1.5, borderColor: AZUL, fontFamily: "Helvetica-Bold" },
  rodape:  { position: "absolute", bottom: 18, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: CINZA },
  nota:    { fontSize: 7, color: CINZA, marginTop: 8 },
});

const NOTA_BASE =
  "Considera pedidos aprovados (aprovado, em produção, pronto, em entrega e entregue) pela data de aprovação. " +
  "Cancelados, rascunhos e pendentes de aprovação não entram. Faturamento = soma dos itens do pedido.";

/** Estilo aceito pelo react-pdf. */
type Estilo = Parameters<typeof StyleSheet.create>[0][string];
/** Coluna: rótulo, largura (0 = flexível), alinhamento. */
type Col = [string, number, "left" | "right"];
/** Célula: texto + estilo extra opcional. */
type Cell = string | { t: string; style?: Estilo };

function celula(cols: Col[], c: Cell, i: number) {
  const [, w, align] = cols[i];
  const t = typeof c === "string" ? c : c.t;
  const extra: Estilo = typeof c === "string" ? {} : c.style ?? {};
  const estilo: Estilo = { paddingHorizontal: 3, textAlign: align, ...(w ? { width: w } : { flex: 1 }), ...extra };
  return h(Text, { key: i, style: estilo }, t);
}

function renderTabela(opts: {
  titulo: string; tenant: string; de: string; ate: string;
  cards: Array<[string, string]>;
  cols: Col[]; linhas: Cell[][]; total: Cell[] | null;
  vazio: string; nota: string;
}): Promise<Buffer> {
  const { cols } = opts;
  const doc = h(Document, { title: `${opts.titulo} ${opts.de} a ${opts.ate}` },
    h(Page, { size: "A4", orientation: "landscape", style: s.page },
      h(View, { style: s.head, fixed: true },
        h(View, null,
          h(Text, { style: s.titulo }, opts.titulo),
          h(Text, { style: s.sub }, `${opts.tenant.trim()}  ·  Período: ${dataBr(opts.de)} a ${dataBr(opts.ate)}`),
        ),
        h(Text, { style: s.sub }, `Gerado em ${dataHoraBr(new Date())}`),
      ),
      h(View, { style: s.cards },
        ...opts.cards.map(([l, v], i) => h(View, { key: i, style: s.card },
          h(Text, { style: s.cardLbl }, l),
          h(Text, { style: s.cardVal }, v),
        )),
      ),
      h(View, { style: s.thRow, fixed: true }, ...cols.map(([l], i) => celula(cols, l, i))),
      ...(opts.linhas.length === 0
        ? [h(Text, { key: "vazio", style: { padding: 10, color: CINZA } }, opts.vazio)]
        : opts.linhas.map((cells, idx) =>
            h(View, { key: idx, style: [s.row, idx % 2 ? s.rowAlt : {}], wrap: false },
              ...cells.map((c, i) => celula(cols, c, i))))),
      opts.total && opts.linhas.length > 0
        ? h(View, { style: s.totRow, wrap: false }, ...opts.total.map((c, i) => celula(cols, c, i)))
        : null,
      h(Text, { style: s.nota }, opts.nota),
      h(View, { style: s.rodape, fixed: true },
        h(Text, null, "Ondda · Relatórios"),
        h(Text, { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Página ${pageNumber} de ${totalPages}` }),
      ),
    ),
  );
  return renderToBuffer(doc);
}

export function renderRelatorioClientesPdf(rel: RelatorioClientes, tenant: string): Promise<Buffer> {
  const cinza = { color: CINZA };
  return renderTabela({
    titulo: "Pedidos e faturamento por cliente",
    tenant, de: rel.de, ate: rel.ate,
    cards: [
      ["Faturamento", brl(rel.faturamento)],
      ["Pedidos", String(rel.totalPedidos)],
      ["Clientes atendidos", String(rel.totalClientes)],
      ["Ticket médio", brl(rel.ticketMedio)],
      ["Recebido", brl(rel.recebido)],
      ["Em aberto", brl(rel.emAberto)],
    ],
    cols: [
      ["#", 18, "left"], ["Cliente", 0, "left"], ["Pedidos", 42, "right"],
      ["Faturamento", 72, "right"], ["% total", 40, "right"], ["Ticket médio", 62, "right"],
      ["Recebido", 66, "right"], ["Em aberto", 66, "right"], ["Último", 50, "right"],
    ],
    linhas: rel.linhas.map((l, i) => [
      { t: String(i + 1), style: cinza }, l.cliente, String(l.pedidos),
      { t: brl(l.faturamento), style: { fontFamily: "Helvetica-Bold" } },
      pct(l.participacao), brl(l.ticketMedio), brl(l.recebido),
      { t: brl(l.emAberto), style: l.emAberto > 0 ? { color: "#b45309" } : {} },
      dataBr(l.ultimoPedido),
    ]),
    total: ["", "Total", String(rel.totalPedidos), brl(rel.faturamento), "100,0%",
      brl(rel.ticketMedio), brl(rel.recebido), brl(rel.emAberto), ""],
    vazio: "Nenhum pedido aprovado no período.",
    nota: `${NOTA_BASE} Recebido e em aberto vêm das cobranças desses pedidos.`,
  });
}

export function renderRelatorioProdutosPdf(rel: RelatorioProdutos, tenant: string): Promise<Buffer> {
  const cinza = { color: CINZA };
  return renderTabela({
    titulo: "Pedidos e faturamento por produto",
    tenant, de: rel.de, ate: rel.ate,
    cards: [
      ["Faturamento", brl(rel.faturamento)],
      ["Pedidos", String(rel.totalPedidos)],
      ["Produtos vendidos", String(rel.totalProdutos)],
    ],
    cols: [
      ["#", 18, "left"], ["Produto", 0, "left"], ["Categoria", 90, "left"],
      ["Quantidade", 70, "right"], ["Pedidos", 44, "right"], ["Clientes", 44, "right"],
      ["Preço médio", 62, "right"], ["Faturamento", 72, "right"], ["% total", 42, "right"],
    ],
    linhas: rel.linhas.map((l, i) => [
      { t: String(i + 1), style: cinza }, l.produto, { t: l.categoria ?? "—", style: cinza },
      `${num(l.quantidade)}${l.unidade ? " " + l.unidade : ""}`, String(l.pedidos), String(l.clientes),
      brl(l.precoMedio),
      { t: brl(l.faturamento), style: { fontFamily: "Helvetica-Bold" } },
      pct(l.participacao),
    ]),
    total: ["", "Total", "", "", String(rel.totalPedidos), "", "", brl(rel.faturamento), "100,0%"],
    vazio: "Nenhum produto vendido no período.",
    nota: `${NOTA_BASE} Quantidade na unidade de venda do produto. "Pedidos" e "Clientes" contam pedidos e clientes distintos que tiveram o produto.`,
  });
}
