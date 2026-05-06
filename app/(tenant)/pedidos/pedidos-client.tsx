"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  List, Columns, ShoppingCart, ArrowRight, Plus,
  Upload, Download, CheckCircle2, AlertTriangle, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatCurrency, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, canSeePrice } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "RASCUNHO" | "PENDENTE_APROVACAO" | "APROVADO"
  | "EM_PRODUCAO" | "PRONTO" | "EM_ENTREGA" | "ENTREGUE" | "CANCELADO";

interface OrderItem {
  product: { name: string; unit: string };
  quantity: string | number;
  unitPrice: string | number;
}

interface Order {
  id: string;
  status: OrderStatus;
  createdAt: string | Date;
  scheduledDeliveryDate?: string | Date | null;
  client?: { name: string | null } | null;
  items: OrderItem[];
}

interface Props {
  initialOrders: Order[];
  role: string;
  isClient: boolean;
}

// ── Kanban config ─────────────────────────────────────────────────────────────

const KANBAN_COLUMNS: {
  status: OrderStatus;
  label: string;
  headerColor: string;
  bgColor: string;
}[] = [
  { status: "PENDENTE_APROVACAO", label: "Aguardando", headerColor: "bg-yellow-400", bgColor: "bg-yellow-50" },
  { status: "APROVADO",           label: "Aprovado",   headerColor: "bg-blue-400",   bgColor: "bg-blue-50"   },
  { status: "EM_PRODUCAO",        label: "Em Produção",headerColor: "bg-blue-600", bgColor: "bg-blue-50" },
  { status: "PRONTO",             label: "Pronto",     headerColor: "bg-purple-400", bgColor: "bg-purple-50" },
  { status: "EM_ENTREGA",         label: "Em Entrega", headerColor: "bg-indigo-400", bgColor: "bg-indigo-50" },
  { status: "ENTREGUE",           label: "Entregue",   headerColor: "bg-green-400",  bgColor: "bg-green-50"  },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDENTE_APROVACAO: "APROVADO",
  APROVADO:           "EM_PRODUCAO",
  EM_PRODUCAO:        "PRONTO",
  PRONTO:             "EM_ENTREGA",
  EM_ENTREGA:         "ENTREGUE",
};

// Roles that can advance orders
const CAN_ADVANCE = ["TENANT_ADMIN", "SUPER_ADMIN", "GERENTE", "OPERADOR"];

const STATUS_TABS = [
  { label: "Todos",       value: "" },
  { label: "Aguardando",  value: "PENDENTE_APROVACAO" },
  { label: "Aprovados",   value: "APROVADO" },
  { label: "Em Produção", value: "EM_PRODUCAO" },
  { label: "Em Entrega",  value: "EM_ENTREGA" },
  { label: "Entregues",   value: "ENTREGUE" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function PedidosClient({ initialOrders, role, isClient }: Props) {
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [statusFilter, setStatusFilter] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragOrderId = useRef<string | null>(null);
  const dragFromStatus = useRef<OrderStatus | null>(null);

  // CSV import state
  const [csvPanel, setCsvPanel]   = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvResult, setCsvResult] = useState<{
    ordersCreated: number; rowErrors: number; skipped: number;
    created: { orderId: string; clientName: string; itemCount: number }[];
    errors: string[];
  } | null>(null);
  const [csvError, setCsvError]   = useState("");
  const csvInputRef = useRef<HTMLInputElement>(null);

  const canAdvance = CAN_ADVANCE.includes(role);

  // ── CSV Import ──────────────────────────────────────────────────────────────

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvLoading(true);
    setCsvError("");
    setCsvResult(null);

    const fd = new FormData();
    fd.append("csv", file);

    const res = await fetch("/api/pedidos/importar-csv", { method: "POST", body: fd });
    const data = await res.json();
    setCsvLoading(false);

    if (!res.ok) { setCsvError(data.error ?? "Erro ao importar CSV."); return; }
    setCsvResult(data);
    // Reload orders list
    const listRes = await fetch("/api/pedidos");
    if (listRes.ok) {
      const listData = await listRes.json();
      if (Array.isArray(listData)) setOrders(listData);
    }
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  // ── Move order ──────────────────────────────────────────────────────────────

  async function moveOrder(orderId: string, newStatus: OrderStatus) {
    const prev = orders.find((o) => o.id === orderId);
    if (!prev || prev.status === newStatus) return;

    // Optimistic update
    setMovingId(orderId);
    setOrders((all) =>
      all.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    const res = await fetch(`/api/pedidos/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    setMovingId(null);

    if (!res.ok) {
      // Revert
      setOrders((all) =>
        all.map((o) => (o.id === orderId ? { ...o, status: prev.status } : o))
      );
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function orderTotal(order: Order) {
    return order.items.reduce(
      (s, i) => s + Number(i.unitPrice) * Number(i.quantity),
      0
    );
  }

  function orderLabel(order: Order) {
    return (
      order.items
        .slice(0, 2)
        .map((i) => i.product.name)
        .join(", ") + (order.items.length > 2 ? ` +${order.items.length - 2}` : "")
    );
  }

  // ── Filtered for list view ───────────────────────────────────────────────────

  const filteredOrders = statusFilter
    ? orders.filter((o) => o.status === statusFilter)
    : orders;

  // ── Kanban columns ─────────────────────────────────────────────────────────

  function columnOrders(status: OrderStatus) {
    return orders.filter((o) => o.status === status);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isClient ? "Meus Pedidos" : "Pedidos"}
          </h1>
          <p className="text-gray-500">{orders.length} resultado(s)</p>
        </div>
        <div className="flex items-center gap-2">
          {isClient && (
            <Link
              href="/catalogo"
              className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900"
            >
              <ShoppingCart className="h-4 w-4" />
              Novo Pedido
            </Link>
          )}
          {!isClient && canAdvance && (
            <Link
              href="/pedidos/novo"
              className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900"
            >
              <Plus className="h-4 w-4" />
              Novo Pedido
            </Link>
          )}
          {!isClient && canAdvance && (
            <button
              onClick={() => { setCsvPanel(!csvPanel); setCsvResult(null); setCsvError(""); }}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" />
              Importar CSV
            </button>
          )}
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <button
              onClick={() => setView("lista")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "lista"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <List className="h-4 w-4" />
              Lista
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "kanban"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Columns className="h-4 w-4" />
              Kanban
            </button>
          </div>
        </div>
      </div>

      {/* ── CSV Import Panel ──────────────────────────────────────────────── */}
      {csvPanel && !isClient && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Importar pedidos via CSV</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Crie vários pedidos de uma vez. Baixe o modelo com dados reais da sua conta.
              </p>
            </div>
            <button onClick={() => setCsvPanel(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Format hint */}
          <div className="rounded-lg bg-white border border-gray-200 p-3 text-xs font-mono text-gray-600 overflow-x-auto">
            <p className="text-gray-400 mb-1">Formato (separador ponto-e-vírgula):</p>
            <p className="text-blue-700 font-semibold">email_cliente;produto;quantidade;observacoes</p>
            <p>cliente@padaria.com;Pão Francês;100;Entregar pela manhã</p>
            <p>cliente@padaria.com;Croissant;50;Entregar pela manhã</p>
            <p>outro@mercado.com;Pão de Forma;30;</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Download sample */}
            <a
              href="/api/pedidos/importar-csv"
              download="modelo-importacao-pedidos.csv"
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar modelo CSV
            </a>

            {/* Upload */}
            <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvImport} />
            <button
              onClick={() => csvInputRef.current?.click()}
              disabled={csvLoading}
              className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-3 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {csvLoading ? "Importando..." : "Enviar CSV"}
            </button>
          </div>

          {/* Error */}
          {csvError && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {csvError}
            </div>
          )}

          {/* Result */}
          {csvResult && (
            <div className="rounded-lg bg-white border border-gray-200 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {csvResult.ordersCreated} pedido(s) criado(s)
                {csvResult.rowErrors > 0 && (
                  <span className="ml-2 text-amber-600">· {csvResult.rowErrors + csvResult.skipped} problema(s)</span>
                )}
              </div>
              {csvResult.created.length > 0 && (
                <div className="max-h-32 overflow-auto space-y-1">
                  {csvResult.created.map((o) => (
                    <div key={o.orderId} className="flex items-center gap-2 text-xs text-gray-600">
                      <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
                      <span className="font-medium">{o.clientName}</span>
                      <span className="text-gray-400">· {o.itemCount} item(s)</span>
                      <Link href={`/pedidos/${o.orderId}`} className="ml-auto text-blue-700 hover:underline">
                        Ver pedido
                      </Link>
                    </div>
                  ))}
                </div>
              )}
              {csvResult.errors.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-amber-600 hover:underline font-medium">
                    Ver problemas ({csvResult.errors.length})
                  </summary>
                  <ul className="mt-1 space-y-0.5 text-gray-500">
                    {csvResult.errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── LIST VIEW ──────────────────────────────────────────────────────── */}
      {view === "lista" && (
        <>
          <div className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-0">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  statusFilter === tab.value
                    ? "border-blue-800 text-blue-800"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const showPrice = canSeePrice(role, order.status);
              return (
                <Link key={order.id} href={`/pedidos/${order.id}`}>
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <p className="font-semibold text-gray-900">
                              #{order.id.slice(-6).toUpperCase()}
                            </p>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ORDER_STATUS_COLORS[order.status]}`}
                            >
                              {ORDER_STATUS_LABELS[order.status]}
                            </span>
                          </div>
                          {!isClient && (
                            <p className="mt-1 text-sm text-gray-500">
                              Cliente: {order.client?.name}
                            </p>
                          )}
                          <p className="mt-0.5 text-xs text-gray-400">
                            {formatDate(order.createdAt)} • {order.items.length} iten(s):{" "}
                            {order.items.slice(0, 3).map((i) => i.product.name).join(", ")}
                          </p>
                          {order.scheduledDeliveryDate && (
                            <p className="mt-1 text-sm font-medium text-blue-900">
                              Entrega prevista: {formatDate(order.scheduledDeliveryDate)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {showPrice ? (
                            <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(orderTotal(order))}
                            </p>
                          ) : (
                            <p className="text-sm italic text-gray-400">Preço após aprovação</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
            {filteredOrders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <ShoppingCart className="mb-4 h-12 w-12 text-gray-200" />
                <p>Nenhum pedido encontrado.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── KANBAN VIEW ────────────────────────────────────────────────────── */}
      {view === "kanban" && (
        <div
          className="flex gap-3 overflow-x-auto pb-2"
          style={{ height: "calc(100vh - 210px)" }}
        >
          {KANBAN_COLUMNS.map((col) => {
            const colOrders = columnOrders(col.status);
            const isDropTarget = dragOver === col.status;

            return (
              <div
                key={col.status}
                className={`flex h-full w-64 flex-shrink-0 flex-col rounded-xl border-2 transition-colors ${
                  isDropTarget
                    ? "border-blue-500 bg-blue-50"
                    : "border-transparent bg-gray-100"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragFromStatus.current !== col.status) {
                    setDragOver(col.status);
                  }
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  if (dragOrderId.current && canAdvance) {
                    moveOrder(dragOrderId.current, col.status);
                  }
                }}
              >
                {/* Column header */}
                <div className={`rounded-t-xl px-3 py-2 ${col.headerColor}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{col.label}</span>
                    <span className="rounded-full bg-white/30 px-2 py-0.5 text-xs font-bold text-white">
                      {colOrders.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ maxHeight: "70vh" }}>
                  {colOrders.map((order) => {
                    const showPrice = canSeePrice(role, order.status);
                    const nextStatus = NEXT_STATUS[order.status];
                    const isMoving = movingId === order.id;

                    return (
                      <div
                        key={order.id}
                        draggable={canAdvance}
                        onDragStart={() => {
                          dragOrderId.current = order.id;
                          dragFromStatus.current = order.status;
                        }}
                        onDragEnd={() => {
                          dragOrderId.current = null;
                          dragFromStatus.current = null;
                        }}
                        className={`rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-opacity ${
                          canAdvance ? "cursor-grab active:cursor-grabbing" : ""
                        } ${isMoving ? "opacity-50" : "opacity-100"}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <Link
                            href={`/pedidos/${order.id}`}
                            className="text-xs font-bold text-gray-900 hover:text-blue-800"
                          >
                            #{order.id.slice(-6).toUpperCase()}
                          </Link>
                          {/* Advance button */}
                          {canAdvance && nextStatus && (
                            <button
                              onClick={() => moveOrder(order.id, nextStatus)}
                              disabled={isMoving}
                              title={`Avançar para ${ORDER_STATUS_LABELS[nextStatus]}`}
                              className="flex items-center gap-0.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 hover:bg-blue-100 hover:text-blue-900 disabled:opacity-40"
                            >
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {!isClient && order.client?.name && (
                          <p className="mt-1 truncate text-xs font-medium text-gray-600">
                            {order.client.name}
                          </p>
                        )}

                        <p className="mt-1 truncate text-xs text-gray-400">{orderLabel(order)}</p>

                        {order.scheduledDeliveryDate && (
                          <p className="mt-1.5 text-xs font-medium text-blue-900">
                            Entrega: {formatDate(order.scheduledDeliveryDate)}
                          </p>
                        )}

                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-gray-400">{formatDate(order.createdAt)}</span>
                          {showPrice && (
                            <span className="text-xs font-bold text-gray-800">
                              {formatCurrency(orderTotal(order))}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {colOrders.length === 0 && (
                    <div
                      className={`flex h-16 items-center justify-center rounded-lg border-2 border-dashed text-xs text-gray-300 ${
                        isDropTarget ? "border-blue-300" : "border-gray-200"
                      }`}
                    >
                      {isDropTarget ? "Soltar aqui" : "Sem pedidos"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
