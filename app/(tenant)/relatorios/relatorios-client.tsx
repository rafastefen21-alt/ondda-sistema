"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, FileDown, Search, ShoppingCart, Users, DollarSign, Receipt, ArrowUpDown, Package, Boxes,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { RelatorioClientes, RelatorioProdutos } from "@/lib/relatorios";

type Aba = "clientes" | "produtos";

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const pct = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const soDigitos = (s: string) => s.replace(/\D/g, "");

function somarDias(iso: string, dias: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Ordena uma lista por uma chave (número ou texto). */
function ordenarPor<T>(lista: T[], chave: keyof T, desc: boolean): T[] {
  const dir = desc ? -1 : 1;
  return [...lista].sort((a, b) => {
    const va = a[chave];
    const vb = b[chave];
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
    return String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR") * dir;
  });
}

function Barra({ valor, max }: { valor: number; max: number }) {
  return (
    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full bg-blue-700" style={{ width: `${max ? Math.max(2, (valor / max) * 100) : 0}%` }} />
    </div>
  );
}

function ThOrdenavel({
  ativo, desc, onClick, children, right,
}: { ativo: boolean; desc: boolean; onClick: () => void; children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 font-medium ${right ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-gray-900 ${ativo ? "text-gray-900" : ""}`}
        title={ativo ? (desc ? "Maior primeiro" : "Menor primeiro") : "Ordenar"}
      >
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </th>
  );
}

export function RelatoriosClient({
  aba, clientes, produtos, hoje,
}: { aba: Aba; clientes: RelatorioClientes; produtos: RelatorioProdutos; hoje: string }) {
  const router = useRouter();
  const periodo = { de: clientes.de, ate: clientes.ate };
  const [de, setDe] = useState(periodo.de);
  const [ate, setAte] = useState(periodo.ate);
  const [busca, setBusca] = useState("");
  const [ordCli, setOrdCli] = useState<{ chave: keyof RelatorioClientes["linhas"][number]; desc: boolean }>({ chave: "faturamento", desc: true });
  const [ordProd, setOrdProd] = useState<{ chave: keyof RelatorioProdutos["linhas"][number]; desc: boolean }>({ chave: "faturamento", desc: true });

  const atalhos = useMemo(() => {
    const [y, m] = hoje.split("-").map(Number);
    const mesAnt = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
    const fimMesAnt = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
    return [
      { rotulo: "Este mês", de: `${hoje.slice(0, 7)}-01`, ate: hoje },
      { rotulo: "Mês anterior", de: mesAnt, ate: fimMesAnt },
      { rotulo: "Últimos 90 dias", de: somarDias(hoje, -89), ate: hoje },
      { rotulo: "Este ano", de: `${y}-01-01`, ate: hoje },
    ];
  }, [hoje]);

  function navegar(novo: { de?: string; ate?: string; aba?: Aba }) {
    const p = { de: novo.de ?? periodo.de, ate: novo.ate ?? periodo.ate, aba: novo.aba ?? aba };
    if (novo.de) setDe(novo.de);
    if (novo.ate) setAte(novo.ate);
    router.push(`/relatorios?aba=${p.aba}&de=${p.de}&ate=${p.ate}`);
  }

  const q = busca.trim().toLowerCase();

  const linhasCli = useMemo(() => {
    const f = q
      ? clientes.linhas.filter((l) =>
          l.cliente.toLowerCase().includes(q) ||
          (soDigitos(q).length >= 3 && soDigitos(l.documento ?? "").includes(soDigitos(q))))
      : clientes.linhas;
    return ordenarPor(f, ordCli.chave, ordCli.desc);
  }, [clientes.linhas, q, ordCli]);

  const linhasProd = useMemo(() => {
    const f = q
      ? produtos.linhas.filter((l) =>
          l.produto.toLowerCase().includes(q) || (l.categoria ?? "").toLowerCase().includes(q))
      : produtos.linhas;
    return ordenarPor(f, ordProd.chave, ordProd.desc);
  }, [produtos.linhas, q, ordProd]);

  const ordenarCli = (chave: typeof ordCli.chave) =>
    setOrdCli((o) => ({ chave, desc: o.chave === chave ? !o.desc : chave !== "cliente" }));
  const ordenarProd = (chave: typeof ordProd.chave) =>
    setOrdProd((o) => ({ chave, desc: o.chave === chave ? !o.desc : chave !== "produto" && chave !== "categoria" }));

  const pdfUrl = `/api/relatorios/${aba}/pdf?de=${periodo.de}&ate=${periodo.ate}`;

  const cards = aba === "clientes"
    ? [
        { rotulo: "Faturamento", valor: formatCurrency(clientes.faturamento), icon: DollarSign, cor: "text-blue-700" },
        { rotulo: "Pedidos", valor: String(clientes.totalPedidos), icon: ShoppingCart, cor: "text-gray-900" },
        { rotulo: "Clientes atendidos", valor: String(clientes.totalClientes), icon: Users, cor: "text-gray-900" },
        { rotulo: "Ticket médio", valor: formatCurrency(clientes.ticketMedio), icon: Receipt, cor: "text-gray-900" },
      ]
    : [
        { rotulo: "Faturamento", valor: formatCurrency(produtos.faturamento), icon: DollarSign, cor: "text-blue-700" },
        { rotulo: "Pedidos", valor: String(produtos.totalPedidos), icon: ShoppingCart, cor: "text-gray-900" },
        { rotulo: "Produtos vendidos", valor: String(produtos.totalProdutos), icon: Package, cor: "text-gray-900" },
        { rotulo: "Mais vendido", valor: produtos.linhas[0]?.produto ?? "—", icon: Boxes, cor: "text-gray-900 text-base" },
      ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BarChart3 className="h-6 w-6 text-blue-700" />
            Relatórios
          </h1>
          <p className="text-gray-500">
            {aba === "clientes" ? "Pedidos e faturamento por cliente" : "Pedidos e faturamento por produto"}
            {" · "}{dataBr(periodo.de)} a {dataBr(periodo.ate)}
          </p>
        </div>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-800 px-3 py-2 text-sm font-medium text-white hover:bg-blue-900"
        >
          <FileDown className="h-4 w-4" />
          Baixar PDF
        </a>
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          ["clientes", "Por cliente", Users],
          ["produtos", "Por produto", Package],
        ] as const).map(([chave, rotulo, Icon]) => (
          <button
            key={chave}
            type="button"
            onClick={() => { setBusca(""); navegar({ aba: chave }); }}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${
              aba === chave ? "border-blue-800 text-blue-800" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <Icon className="h-4 w-4" />
            {rotulo}
          </button>
        ))}
      </div>

      {/* Período */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <label className="space-y-1 text-xs text-gray-600">
            De
            <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)}
              className="block rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="space-y-1 text-xs text-gray-600">
            Até
            <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)}
              className="block rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <button
            type="button"
            onClick={() => navegar({ de, ate })}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
          >
            Aplicar
          </button>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            {atalhos.map((a) => {
              const ativo = a.de === periodo.de && a.ate === periodo.ate;
              return (
                <button
                  key={a.rotulo}
                  type="button"
                  onClick={() => navegar({ de: a.de, ate: a.ate })}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    ativo ? "bg-blue-800 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {a.rotulo}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.rotulo}>
            <CardContent className="p-4">
              <p className="flex items-center gap-2 text-sm text-gray-500">
                <c.icon className="h-4 w-4" />
                {c.rotulo}
              </p>
              <p className={`mt-1 truncate text-2xl font-bold ${c.cor}`} title={c.valor}>{c.valor}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              {aba === "clientes" ? "Por cliente" : "Por produto"}
            </h2>
            <div className="relative sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={aba === "clientes" ? "Buscar cliente ou CNPJ/CPF" : "Buscar produto ou categoria"}
                className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm"
              />
            </div>
          </div>

          {aba === "clientes" ? (
            linhasCli.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">
                {clientes.linhas.length === 0 ? "Nenhum pedido aprovado no período." : "Nenhum cliente encontrado."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="w-10 px-3 py-2 text-left font-medium">#</th>
                      <ThOrdenavel ativo={ordCli.chave === "cliente"} desc={ordCli.desc} onClick={() => ordenarCli("cliente")}>Cliente</ThOrdenavel>
                      <ThOrdenavel right ativo={ordCli.chave === "pedidos"} desc={ordCli.desc} onClick={() => ordenarCli("pedidos")}>Pedidos</ThOrdenavel>
                      <ThOrdenavel right ativo={ordCli.chave === "faturamento"} desc={ordCli.desc} onClick={() => ordenarCli("faturamento")}>Faturamento</ThOrdenavel>
                      <ThOrdenavel right ativo={ordCli.chave === "ticketMedio"} desc={ordCli.desc} onClick={() => ordenarCli("ticketMedio")}>Ticket médio</ThOrdenavel>
                      <ThOrdenavel right ativo={ordCli.chave === "recebido"} desc={ordCli.desc} onClick={() => ordenarCli("recebido")}>Recebido</ThOrdenavel>
                      <ThOrdenavel right ativo={ordCli.chave === "emAberto"} desc={ordCli.desc} onClick={() => ordenarCli("emAberto")}>Em aberto</ThOrdenavel>
                      <ThOrdenavel right ativo={ordCli.chave === "ultimoPedido"} desc={ordCli.desc} onClick={() => ordenarCli("ultimoPedido")}>Último pedido</ThOrdenavel>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasCli.map((l, i) => (
                      <tr key={l.clienteId} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2">
                          <a href={`/clientes/${l.clienteId}`} className="font-medium text-gray-900 hover:text-blue-800 hover:underline">
                            {l.cliente}
                          </a>
                          <div className="mt-1 flex items-center gap-2">
                            <Barra valor={l.faturamento} max={clientes.linhas[0]?.faturamento ?? 0} />
                            <span className="text-xs text-gray-400">{pct(l.participacao)} do total</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.pedidos}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(l.faturamento)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(l.ticketMedio)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-green-700">{formatCurrency(l.recebido)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${l.emAberto > 0 ? "text-amber-700" : "text-gray-400"}`}>
                          {formatCurrency(l.emAberto)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-600">{dataBr(l.ultimoPedido)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {!q && (
                    <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                      <tr>
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right tabular-nums">{clientes.totalPedidos}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(clientes.faturamento)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(clientes.ticketMedio)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-green-700">{formatCurrency(clientes.recebido)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-amber-700">{formatCurrency(clientes.emAberto)}</td>
                        <td className="px-3 py-2" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )
          ) : linhasProd.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">
              {produtos.linhas.length === 0 ? "Nenhum produto vendido no período." : "Nenhum produto encontrado."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="w-10 px-3 py-2 text-left font-medium">#</th>
                    <ThOrdenavel ativo={ordProd.chave === "produto"} desc={ordProd.desc} onClick={() => ordenarProd("produto")}>Produto</ThOrdenavel>
                    <ThOrdenavel ativo={ordProd.chave === "categoria"} desc={ordProd.desc} onClick={() => ordenarProd("categoria")}>Categoria</ThOrdenavel>
                    <ThOrdenavel right ativo={ordProd.chave === "quantidade"} desc={ordProd.desc} onClick={() => ordenarProd("quantidade")}>Quantidade</ThOrdenavel>
                    <ThOrdenavel right ativo={ordProd.chave === "pedidos"} desc={ordProd.desc} onClick={() => ordenarProd("pedidos")}>Pedidos</ThOrdenavel>
                    <ThOrdenavel right ativo={ordProd.chave === "clientes"} desc={ordProd.desc} onClick={() => ordenarProd("clientes")}>Clientes</ThOrdenavel>
                    <ThOrdenavel right ativo={ordProd.chave === "precoMedio"} desc={ordProd.desc} onClick={() => ordenarProd("precoMedio")}>Preço médio</ThOrdenavel>
                    <ThOrdenavel right ativo={ordProd.chave === "faturamento"} desc={ordProd.desc} onClick={() => ordenarProd("faturamento")}>Faturamento</ThOrdenavel>
                  </tr>
                </thead>
                <tbody>
                  {linhasProd.map((l, i) => (
                    <tr key={l.produtoId} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium text-gray-900">{l.produto}</span>
                        <div className="mt-1 flex items-center gap-2">
                          <Barra valor={l.faturamento} max={produtos.linhas[0]?.faturamento ?? 0} />
                          <span className="text-xs text-gray-400">{pct(l.participacao)} do total</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{l.categoria ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{num(l.quantidade)} <span className="text-gray-400">{l.unidade}</span></td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.pedidos}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.clientes}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(l.precoMedio)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(l.faturamento)}</td>
                    </tr>
                  ))}
                </tbody>
                {!q && (
                  <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <tr>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2">Total</td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-right tabular-nums">{produtos.totalPedidos}</td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(produtos.faturamento)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400">
        Considera pedidos aprovados (aprovado, em produção, pronto, em entrega e entregue) pela data de aprovação.
        Cancelados, rascunhos e pendentes de aprovação não entram. Faturamento é a soma dos itens do pedido.
        {aba === "clientes"
          ? " Recebido e em aberto vêm das cobranças desses pedidos."
          : " Quantidade na unidade de venda; pedidos e clientes contam os distintos que tiveram o produto."}
      </p>
    </div>
  );
}
