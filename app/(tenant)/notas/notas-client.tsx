"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText, Download, AlertCircle, CheckCircle2, Clock, XCircle,
  Edit3, Ban, Search, RefreshCw, ExternalLink, FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type InvoiceStatus = "EMITIDA" | "PROCESSANDO" | "ERRO" | "CANCELADA";

export interface InvoiceItem {
  id: string;
  status: InvoiceStatus;
  number: string | null;
  accessKey: string | null;
  focusNfeRef: string | null;
  pdfUrl: string | null;
  issuedAt: string | null;
  createdAt: string;
  errorMsg: string | null;
  orderId: string;
  clientName: string | null;
}

const STATUS_CFG: Record<InvoiceStatus, { label: string; variant: "success" | "warning" | "destructive" | "secondary"; icon: React.ElementType; row: string }> = {
  EMITIDA:     { label: "Emitida",     variant: "success",     icon: CheckCircle2, row: "" },
  PROCESSANDO: { label: "Processando", variant: "warning",     icon: Clock,        row: "bg-amber-50/40" },
  ERRO:        { label: "Erro",        variant: "destructive", icon: AlertCircle,  row: "bg-red-50/40" },
  CANCELADA:   { label: "Cancelada",   variant: "secondary",   icon: XCircle,      row: "bg-gray-50" },
};

export function NotasClient({ invoices: initial }: { invoices: InvoiceItem[] }) {
  const [invoices, setInvoices] = useState(initial);
  const [search, setSearch]     = useState("");
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | "TODOS">("TODOS");
  const [refreshing, setRefreshing]     = useState(false);

  // CC-e state
  const [cceInvoice, setCceInvoice] = useState<InvoiceItem | null>(null);
  const [cceTexto, setCceTexto]     = useState("");
  const [cceSeq, setCceSeq]         = useState("1");
  const [cceLoading, setCceLoading] = useState(false);
  const [cceError, setCceError]     = useState("");
  const [cceSuccess, setCceSuccess] = useState(false);
  const [cceLinks, setCceLinks]     = useState<{ xmlUrl: string | null; pdfUrl: string | null } | null>(null);

  // CC-e existente state
  const [cceViewInvoice, setCceViewInvoice] = useState<InvoiceItem | null>(null);
  const [cceViewData, setCceViewData]       = useState<{ xmlUrl: string | null; pdfUrl: string | null; correcao: string | null; data_evento: string | null } | null>(null);
  const [cceViewLoading, setCceViewLoading] = useState(false);
  const [cceViewError, setCceViewError]     = useState("");

  // Cancelamento state
  const [cancelInvoice, setCancelInvoice] = useState<InvoiceItem | null>(null);
  const [cancelJust, setCancelJust]       = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError]     = useState("");
  const [cancelSuccess, setCancelSuccess] = useState(false);

  // ── Counts ──────────────────────────────────────────────────────────────────
  const counts = {
    EMITIDA:     invoices.filter((i) => i.status === "EMITIDA").length,
    CANCELADA:   invoices.filter((i) => i.status === "CANCELADA").length,
    PROCESSANDO: invoices.filter((i) => i.status === "PROCESSANDO").length,
    ERRO:        invoices.filter((i) => i.status === "ERRO").length,
  };

  // ── Filtered list ────────────────────────────────────────────────────────
  const filtered = invoices.filter((inv) => {
    const matchSearch = !search ||
      (inv.number ?? "").includes(search) ||
      (inv.clientName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.accessKey ?? "").includes(search);
    const matchStatus = filterStatus === "TODOS" || inv.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // ── Refresh ──────────────────────────────────────────────────────────────
  async function handleRefresh() {
    setRefreshing(true);
    const res  = await fetch("/api/nfe");
    if (res.ok) setInvoices(await res.json());
    setRefreshing(false);
  }

  // ── CC-e ─────────────────────────────────────────────────────────────────
  async function handleCce(e: React.FormEvent) {
    e.preventDefault();
    if (!cceInvoice) return;
    setCceError(""); setCceLoading(true);
    const res  = await fetch(`/api/nfe/${cceInvoice.id}/carta-correcao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: cceTexto, sequencia: parseInt(cceSeq, 10) }),
    });
    setCceLoading(false);
    const data = await res.json();
    if (!res.ok) { setCceError(data.error ?? "Erro ao enviar CC-e."); return; }
    setCceLinks({ xmlUrl: data.xmlUrl ?? null, pdfUrl: data.pdfUrl ?? null });
    setCceSuccess(true);
  }

  // ── Consultar CC-e existente ─────────────────────────────────────────────
  async function openCceView(inv: InvoiceItem) {
    setCceViewInvoice(inv);
    setCceViewData(null);
    setCceViewError("");
    setCceViewLoading(true);
    const res = await fetch(`/api/nfe/${inv.id}/carta-correcao`);
    setCceViewLoading(false);
    if (!res.ok) { setCceViewError("Nenhuma CC-e encontrada para esta nota."); return; }
    const d = await res.json();
    setCceViewData({ xmlUrl: d.xmlUrl, pdfUrl: d.pdfUrl, correcao: d.correcao, data_evento: d.data_evento });
  }

  // ── Cancelar ─────────────────────────────────────────────────────────────
  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelInvoice) return;
    setCancelError(""); setCancelLoading(true);
    const res = await fetch(`/api/nfe/${cancelInvoice.id}/cancelar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ justificativa: cancelJust }),
    });
    setCancelLoading(false);
    if (!res.ok) { setCancelError((await res.json()).error ?? "Erro ao cancelar."); return; }
    setCancelSuccess(true);
    setInvoices((prev) =>
      prev.map((inv) => inv.id === cancelInvoice.id ? { ...inv, status: "CANCELADA" } : inv),
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["EMITIDA", "CANCELADA", "PROCESSANDO", "ERRO"] as const).map((s) => {
          const cfg = STATUS_CFG[s];
          const Icon = cfg.icon;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? "TODOS" : s)}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${
                filterStatus === s ? "border-blue-700 bg-blue-50 ring-1 ring-blue-700" : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <p className="text-2xl font-bold text-gray-900">{counts[s]}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${s === "EMITIDA" ? "text-green-600" : s === "CANCELADA" ? "text-gray-500" : s === "PROCESSANDO" ? "text-amber-600" : "text-red-600"}`} />
                <p className="text-xs text-gray-500">{cfg.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar por nº, cliente ou chave…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-gray-200" />
          <p className="text-sm text-gray-400">Nenhuma nota encontrada.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Nota</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Data</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((inv) => {
                const cfg  = STATUS_CFG[inv.status] ?? STATUS_CFG.PROCESSANDO;
                const Icon = cfg.icon;
                return (
                  <tr key={inv.id} className={`transition-colors hover:bg-gray-50/60 ${cfg.row}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {inv.number ? `NF-e nº ${inv.number}` : "NF-e (processando)"}
                      </p>
                      {inv.accessKey && (
                        <p className="text-xs text-gray-400 font-mono truncate max-w-[180px]" title={inv.accessKey}>
                          {inv.accessKey.slice(0, 20)}…
                        </p>
                      )}
                      {inv.errorMsg && (
                        <p className="text-xs text-red-500 mt-0.5">{inv.errorMsg}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{inv.clientName ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={cfg.variant} className="inline-flex items-center gap-1">
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {inv.issuedAt
                        ? formatDate(new Date(inv.issuedAt))
                        : formatDate(new Date(inv.createdAt))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* DANFE */}
                        {inv.pdfUrl && (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Baixar DANFE"
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            DANFE
                          </a>
                        )}
                        {/* XML */}
                        {inv.status === "EMITIDA" && inv.focusNfeRef && (
                          <a
                            href={`/api/nfe/${inv.id}/xml`}
                            download
                            title="Baixar XML"
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            XML
                          </a>
                        )}
                        {/* Enviar CC-e */}
                        {inv.status === "EMITIDA" && (
                          <button
                            onClick={() => { setCceInvoice(inv); setCceTexto(""); setCceSeq("1"); setCceError(""); setCceSuccess(false); setCceLinks(null); }}
                            title="Enviar Carta de Correção"
                            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            CC-e
                          </button>
                        )}
                        {/* Baixar CC-e já enviada */}
                        {inv.status === "EMITIDA" && (
                          <button
                            onClick={() => openCceView(inv)}
                            title="Baixar CC-e já enviada"
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            <FileCheck className="h-3.5 w-3.5" />
                            Ver CC-e
                          </button>
                        )}
                        {/* Cancelar */}
                        {inv.status === "EMITIDA" && (
                          <button
                            onClick={() => { setCancelInvoice(inv); setCancelJust(""); setCancelError(""); setCancelSuccess(false); }}
                            title="Cancelar NF-e"
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Cancelar
                          </button>
                        )}
                        {/* Ver pedido */}
                        <Link
                          href={`/pedidos/${inv.orderId}`}
                          title="Ver pedido"
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Pedido
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal CC-e ── */}
      {cceInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-base font-bold text-gray-900">Carta de Correção Eletrônica (CC-e)</h2>
            <p className="mb-4 text-sm text-gray-500">
              {cceInvoice.number ? `NF-e nº ${cceInvoice.number}` : "NF-e"} · {cceInvoice.clientName}
            </p>

            {cceSuccess ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="font-semibold text-gray-900">CC-e enviada com sucesso!</p>
                <p className="text-sm text-gray-500">Transmitida à SEFAZ e registrada na nota fiscal.</p>
                {(cceLinks?.xmlUrl || cceLinks?.pdfUrl) && (
                  <div className="flex gap-3 mt-1">
                    {cceLinks.xmlUrl && (
                      <a
                        href={cceLinks.xmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Download className="h-4 w-4" />
                        XML da CC-e
                      </a>
                    )}
                    {cceLinks.pdfUrl && (
                      <a
                        href={cceLinks.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Download className="h-4 w-4" />
                        PDF da CC-e
                      </a>
                    )}
                  </div>
                )}
                <Button className="mt-2 w-full" onClick={() => setCceInvoice(null)}>Fechar</Button>
              </div>
            ) : (
              <>
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <p className="font-semibold mb-1">Pode corrigir: CFOP, CSOSN/CST, dados complementares, transportador.</p>
                  <p className="font-semibold">Não pode: valores, emitente, destinatário, datas, quantidades.</p>
                  <p className="mt-1 text-amber-700">Sem acentos ou caracteres especiais no texto.</p>
                </div>
                <form onSubmit={handleCce} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cce-texto">Texto da correção (15–1000 caracteres)</Label>
                    <Textarea
                      id="cce-texto"
                      rows={5}
                      value={cceTexto}
                      onChange={(e) => setCceTexto(e.target.value)}
                      minLength={15}
                      maxLength={1000}
                      required
                      placeholder="Ex: Corrijo o CFOP de 5401 para 5405 e o CSOSN de 102 para 500, pois o emitente nao produz os produtos, realizando apenas revenda."
                      className="resize-none"
                    />
                    <p className="text-xs text-gray-400">{cceTexto.length}/1000</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cce-seq">Sequência (1ª CC-e = 1)</Label>
                    <input
                      id="cce-seq"
                      type="number"
                      min={1} max={20}
                      value={cceSeq}
                      onChange={(e) => setCceSeq(e.target.value)}
                      required
                      className="flex h-10 w-24 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                    />
                  </div>
                  {cceError && <p className="text-xs text-red-600">{cceError}</p>}
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setCceInvoice(null)}>Cancelar</Button>
                    <Button type="submit" className="flex-1" disabled={cceLoading}>
                      {cceLoading ? "Enviando…" : "Enviar CC-e"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Ver CC-e existente ── */}
      {cceViewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Carta de Correção</h2>
                <p className="text-sm text-gray-500">
                  {cceViewInvoice.number ? `NF-e nº ${cceViewInvoice.number}` : "NF-e"} · {cceViewInvoice.clientName}
                </p>
              </div>
              <button onClick={() => setCceViewInvoice(null)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">✕</button>
            </div>

            {cceViewLoading && (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            )}
            {cceViewError && !cceViewLoading && (
              <p className="py-6 text-center text-sm text-gray-400">{cceViewError}</p>
            )}
            {cceViewData && !cceViewLoading && (
              <div className="space-y-4">
                {cceViewData.data_evento && (
                  <p className="text-xs text-gray-400">
                    Enviada em {new Date(cceViewData.data_evento).toLocaleString("pt-BR")}
                  </p>
                )}
                {cceViewData.correcao && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Texto da correção:</p>
                    <p className="text-sm text-gray-700">{cceViewData.correcao}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  {cceViewData.xmlUrl && (
                    <a
                      href={cceViewData.xmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4" />
                      XML da CC-e
                    </a>
                  )}
                  {cceViewData.pdfUrl && (
                    <a
                      href={cceViewData.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4" />
                      PDF da CC-e
                    </a>
                  )}
                </div>
                <Button variant="outline" className="w-full" onClick={() => setCceViewInvoice(null)}>Fechar</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Cancelamento ── */}
      {cancelInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-base font-bold text-gray-900">Cancelar NF-e</h2>
            <p className="mb-4 text-sm text-gray-500">
              {cancelInvoice.number ? `NF-e nº ${cancelInvoice.number}` : "NF-e"} · {cancelInvoice.clientName}
            </p>

            {cancelSuccess ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="font-semibold text-gray-900">NF-e cancelada!</p>
                <p className="text-sm text-gray-500">Cancelamento transmitido à SEFAZ com sucesso.</p>
                <Button className="mt-2 w-full" onClick={() => setCancelInvoice(null)}>Fechar</Button>
              </div>
            ) : (
              <>
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <p className="font-semibold">Atenção:</p>
                  <ul className="mt-1 list-disc pl-4 space-y-0.5">
                    <li>O cancelamento só é aceito pela SEFAZ em até 24h após a emissão.</li>
                    <li>Após cancelada, a nota não pode ser reativada.</li>
                    <li>A justificativa deve ter entre 15 e 255 caracteres.</li>
                  </ul>
                </div>
                <form onSubmit={handleCancel} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cancel-just">Justificativa</Label>
                    <Textarea
                      id="cancel-just"
                      rows={3}
                      value={cancelJust}
                      onChange={(e) => setCancelJust(e.target.value)}
                      minLength={15}
                      maxLength={255}
                      required
                      placeholder="Ex: Nota emitida com erro de CFOP. Será reemitida corretamente."
                      className="resize-none"
                    />
                    <p className="text-xs text-gray-400">{cancelJust.length}/255</p>
                  </div>
                  {cancelError && <p className="text-xs text-red-600">{cancelError}</p>}
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setCancelInvoice(null)}>
                      Voltar
                    </Button>
                    <Button type="submit" variant="destructive" className="flex-1" disabled={cancelLoading}>
                      {cancelLoading ? "Cancelando…" : "Confirmar cancelamento"}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
