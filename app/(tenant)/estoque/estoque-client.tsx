"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Package, AlertTriangle, XCircle, CheckCircle2,
  Upload, Plus, Minus, Settings2, History, FileText,
  Search, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// ─── Types ────────────────────────────────────────────────────────────────────

// Inlined here to avoid pulling lib/stock.ts (imports Prisma) into a client bundle
type StockStatus = "OK" | "ALERTA" | "CRITICO";
function getStockStatus(quantity: number, alertThreshold: number | null): StockStatus {
  if (quantity <= 0) return "CRITICO";
  if (alertThreshold !== null && quantity <= alertThreshold) return "ALERTA";
  return "OK";
}

interface Movement {
  id: string;
  type: "ENTRADA" | "SAIDA" | "AJUSTE";
  quantity: number;
  reason: string | null;
  createdAt: string;
}

interface StockItem {
  id: string;
  name: string;
  unit: string;
  ncm: string | null;
  categoryName: string | null;
  quantity: number;
  alertThreshold: number | null;
  recentMovements: Movement[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<StockStatus, { label: string; color: string; icon: React.ElementType }> = {
  OK:      { label: "OK",           color: "text-green-600 bg-green-50 border-green-200",  icon: CheckCircle2 },
  ALERTA:  { label: "Em alerta",    color: "text-amber-600 bg-amber-50 border-amber-200",  icon: AlertTriangle },
  CRITICO: { label: "Crítico",      color: "text-red-600   bg-red-50   border-red-200",    icon: XCircle },
};

const MOVE_COLOR = {
  ENTRADA: "text-green-600",
  SAIDA:   "text-red-600",
  AJUSTE:  "text-blue-600",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EstoqueClient({ items: initialItems }: { items: StockItem[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<StockStatus | "TODOS">("TODOS");

  // XML import state
  const [xmlPanel, setXmlPanel]         = useState(false);
  const [xmlLoading, setXmlLoading]     = useState(false);
  const [xmlResult, setXmlResult]       = useState<{ imported: number; notMapped: number; results: unknown[] } | null>(null);
  const [xmlError, setXmlError]         = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Adjust modal state
  const [adjustItem, setAdjustItem]     = useState<StockItem | null>(null);
  const [adjustDelta, setAdjustDelta]   = useState("");
  const [adjustType, setAdjustType]     = useState<"ENTRADA" | "SAIDA" | "AJUSTE">("AJUSTE");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError]   = useState("");

  // Threshold modal state
  const [thresholdItem, setThresholdItem]   = useState<StockItem | null>(null);
  const [thresholdValue, setThresholdValue] = useState("");
  const [thresholdLoading, setThresholdLoading] = useState(false);

  // History modal
  const [historyItem, setHistoryItem] = useState<StockItem | null>(null);

  // Derived
  const alertCount   = items.filter((i) => getStockStatus(i.quantity, i.alertThreshold) === "ALERTA").length;
  const criticoCount = items.filter((i) => getStockStatus(i.quantity, i.alertThreshold) === "CRITICO").length;

  const filtered = items.filter((i) => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.categoryName ?? "").toLowerCase().includes(search.toLowerCase());
    const status = getStockStatus(i.quantity, i.alertThreshold);
    const matchStatus = filterStatus === "TODOS" || status === filterStatus;
    return matchSearch && matchStatus;
  });

  function refresh() {
    startTransition(() => { router.refresh(); });
    // Re-fetch items from API
    fetch("/api/estoque")
      .then((r) => r.json())
      .then((data) => {
        setItems(data.map((p: {
          id: string; name: string; unit: string; ncm: string | null;
          category: { name: string } | null;
          stockItem: { quantity: number; alertThreshold: number | null;
            movements: { id: string; type: string; quantity: number; reason: string | null; createdAt: string }[]
          } | null;
        }) => ({
          id: p.id, name: p.name, unit: p.unit, ncm: p.ncm,
          categoryName: p.category?.name ?? null,
          quantity: p.stockItem ? Number(p.stockItem.quantity) : 0,
          alertThreshold: p.stockItem?.alertThreshold ? Number(p.stockItem.alertThreshold) : null,
          recentMovements: (p.stockItem?.movements ?? []).map((m) => ({
            id: m.id, type: m.type, quantity: Number(m.quantity),
            reason: m.reason, createdAt: m.createdAt,
          })),
        })));
      });
  }

  // ── XML Import ──────────────────────────────────────────────────────────────
  async function handleXmlImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setXmlLoading(true);
    setXmlError("");
    setXmlResult(null);

    const fd = new FormData();
    fd.append("xml", file);

    const res = await fetch("/api/estoque/importar-xml", { method: "POST", body: fd });
    const data = await res.json();
    setXmlLoading(false);

    if (!res.ok) { setXmlError(data.error ?? "Erro ao importar XML."); return; }
    setXmlResult(data);
    refresh();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Adjust Stock ────────────────────────────────────────────────────────────
  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustItem) return;
    setAdjustError("");
    setAdjustLoading(true);

    const delta = adjustType === "SAIDA"
      ? -Math.abs(parseFloat(adjustDelta))
      : Math.abs(parseFloat(adjustDelta));

    const res = await fetch("/api/estoque", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: adjustItem.id, delta, type: adjustType, reason: adjustReason || undefined }),
    });
    const data = await res.json();
    setAdjustLoading(false);

    if (!res.ok) { setAdjustError(data.error ?? "Erro ao ajustar estoque."); return; }
    setAdjustItem(null);
    setAdjustDelta("");
    setAdjustReason("");
    refresh();
  }

  // ── Alert Threshold ─────────────────────────────────────────────────────────
  async function handleThreshold(e: React.FormEvent) {
    e.preventDefault();
    if (!thresholdItem) return;
    setThresholdLoading(true);

    await fetch(`/api/estoque/${thresholdItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertThreshold: thresholdValue ? parseFloat(thresholdValue) : null }),
    });
    setThresholdLoading(false);
    setThresholdItem(null);
    refresh();
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Controle de Estoque</h1>
          <p className="text-sm text-gray-500">
            {items.length} produto(s) ·{" "}
            {alertCount > 0 && <span className="text-amber-600 font-medium">{alertCount} em alerta · </span>}
            {criticoCount > 0 && <span className="text-red-600 font-medium">{criticoCount} crítico(s)</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setXmlPanel(!xmlPanel)} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            Importar XML NF-e
          </Button>
        </div>
      </div>

      {/* Alert banners */}
      {(alertCount > 0 || criticoCount > 0) && (
        <div className="space-y-2">
          {criticoCount > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <XCircle className="h-5 w-5 shrink-0 text-red-500" />
              <p className="text-sm font-medium text-red-700">
                {criticoCount} produto(s) com estoque <strong>zerado ou negativo</strong> — reposição urgente necessária.
              </p>
            </div>
          )}
          {alertCount > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
              <p className="text-sm font-medium text-amber-700">
                {alertCount} produto(s) <strong>em alerta</strong> — estoque abaixo do limite configurado.
              </p>
            </div>
          )}
        </div>
      )}

      {/* XML Import panel */}
      {xmlPanel && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-blue-600" />
              Importar NF-e XML
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Selecione o arquivo XML de uma NF-e de entrada. O sistema vai identificar os produtos
              pelo NCM cadastrado e dar entrada automática no estoque.
            </p>
            <div className="flex items-center gap-3">
              <input ref={fileInputRef} type="file" accept=".xml" className="hidden" onChange={handleXmlImport} />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={xmlLoading}
                variant="outline"
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                {xmlLoading ? "Processando..." : "Selecionar XML"}
              </Button>
              {xmlLoading && <span className="text-sm text-gray-500">Importando itens...</span>}
            </div>
            {xmlError && <p className="text-sm text-red-600">{xmlError}</p>}
            {xmlResult && (
              <div className="rounded-md border border-gray-200 bg-white p-3 text-sm">
                <p className="font-semibold text-gray-800 mb-2">
                  Resultado: {xmlResult.imported} importado(s) · {xmlResult.notMapped} não mapeado(s)
                </p>
                <div className="max-h-40 overflow-auto space-y-1">
                  {(xmlResult.results as { nItem: number; xProd: string; ncm: string; quantity: number; status: string; productName?: string }[]).map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={r.status === "importado" ? "text-green-600" : "text-amber-600"}>
                        {r.status === "importado" ? "✓" : "?"}
                      </span>
                      <span className="text-gray-700">{r.xProd}</span>
                      <span className="text-gray-400">NCM {r.ncm}</span>
                      <span className="text-gray-400">· {r.quantity} un</span>
                      {r.status === "importado" && (
                        <span className="text-green-600">→ {r.productName}</span>
                      )}
                      {r.status === "nao_mapeado" && (
                        <span className="text-amber-600">→ produto não encontrado (verifique o NCM)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["TODOS", "ALERTA", "CRITICO", "OK"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filterStatus === s
                  ? "bg-blue-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "TODOS" ? "Todos" : s === "ALERTA" ? "Em Alerta" : s === "CRITICO" ? "Crítico" : "OK"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Produto</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Estoque</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Limite alerta</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((item) => {
              const status = getStockStatus(item.quantity, item.alertThreshold);
              const cfg    = STATUS_CONFIG[status];
              const Icon   = cfg.icon;
              return (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    {item.categoryName && (
                      <p className="text-xs text-gray-400">{item.categoryName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-base font-bold ${
                      status === "CRITICO" ? "text-red-600" :
                      status === "ALERTA"  ? "text-amber-600" : "text-gray-900"
                    }`}>
                      {item.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                    </span>
                    <span className="ml-1 text-xs text-gray-400">{item.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.alertThreshold !== null ? (
                      <span className="text-sm text-gray-700">
                        {item.alertThreshold.toLocaleString("pt-BR")} {item.unit}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => { setAdjustItem(item); setAdjustDelta(""); setAdjustType("ENTRADA"); setAdjustReason(""); setAdjustError(""); }}
                        title="Ajustar estoque"
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setAdjustItem(item); setAdjustDelta(""); setAdjustType("SAIDA"); setAdjustReason(""); setAdjustError(""); }}
                        title="Dar saída"
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setThresholdItem(item); setThresholdValue(item.alertThreshold?.toString() ?? ""); }}
                        title="Configurar limite de alerta"
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Settings2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setHistoryItem(item)}
                        title="Ver histórico"
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <History className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="mb-3 h-10 w-10 text-gray-200" />
            <p className="text-sm text-gray-400">Nenhum produto encontrado.</p>
          </div>
        )}
      </div>

      {/* ── Modal: Ajuste de estoque ── */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-base font-bold text-gray-900">Movimentar estoque</h2>
            <p className="mb-4 text-sm text-gray-500">{adjustItem.name}</p>
            <form onSubmit={handleAdjust} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <div className="flex gap-2">
                  {(["ENTRADA", "SAIDA", "AJUSTE"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAdjustType(t)}
                      className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                        adjustType === t
                          ? t === "ENTRADA" ? "border-green-500 bg-green-50 text-green-700"
                          : t === "SAIDA"  ? "border-red-500 bg-red-50 text-red-700"
                          : "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {t === "ENTRADA" ? "+ Entrada" : t === "SAIDA" ? "− Saída" : "Ajuste"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delta">Quantidade ({adjustItem.unit})</Label>
                <Input
                  id="delta"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  placeholder="Ex: 100"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reason">Motivo</Label>
                <Input
                  id="reason"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ex: Compra fornecedor, Perda, Inventário..."
                />
              </div>
              {adjustError && <p className="text-xs text-red-600">{adjustError}</p>}
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setAdjustItem(null)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={adjustLoading}>
                  {adjustLoading ? "Salvando..." : "Confirmar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Limite de alerta ── */}
      {thresholdItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-base font-bold text-gray-900">Limite de alerta</h2>
            <p className="mb-1 text-sm text-gray-500">{thresholdItem.name}</p>
            <p className="mb-4 text-xs text-gray-400">
              Quando o estoque atingir ou ficar abaixo desse valor, o produto será marcado como <strong>"Em alerta"</strong>.
            </p>
            <form onSubmit={handleThreshold} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="threshold">Limite mínimo ({thresholdItem.unit})</Label>
                <Input
                  id="threshold"
                  type="number"
                  step="0.001"
                  min="0"
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  placeholder="Ex: 50"
                />
                <p className="text-xs text-gray-400">Deixe em branco para desativar o alerta.</p>
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setThresholdItem(null)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={thresholdLoading}>
                  {thresholdLoading ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Histórico ── */}
      {historyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Histórico</h2>
                <p className="text-sm text-gray-500">{historyItem.name}</p>
              </div>
              <button
                onClick={() => setHistoryItem(null)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            {historyItem.recentMovements.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Sem movimentações registradas.</p>
            ) : (
              <div className="max-h-72 overflow-auto space-y-2">
                {historyItem.recentMovements.map((m) => (
                  <div key={m.id} className="flex items-start justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div>
                      <p className={`text-xs font-semibold ${MOVE_COLOR[m.type]}`}>
                        {m.type === "ENTRADA" ? "Entrada" : m.type === "SAIDA" ? "Saída" : "Ajuste"}
                      </p>
                      <p className="text-xs text-gray-500">{m.reason ?? "—"}</p>
                      <p className="text-xs text-gray-400">{fmtDate(m.createdAt)}</p>
                    </div>
                    <span className={`text-sm font-bold ${MOVE_COLOR[m.type]}`}>
                      {m.type === "SAIDA" ? "−" : "+"}{Math.abs(m.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {historyItem.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" className="mt-4 w-full" onClick={() => setHistoryItem(null)}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
