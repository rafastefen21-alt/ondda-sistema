"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle, XCircle, ChevronDown, ChevronUp, Clock,
  Mail, Phone, User, CalendarDays, ShoppingBag, MapPin, FileText, Truck, UserCheck, UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  product: { name: string; unit: string; price: number };
}

interface PendingClient {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  createdAt: Date;
}

interface Client {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  createdAt: Date;
  active: boolean;
  totalOrders: number;
}

interface Order {
  id: string;
  createdAt: Date;
  notes: string | null;
  requestedDate: Date | null;
  deliveryAddress: string | null;
  client: Client;
  items: OrderItem[];
}

export function AprovacoesClient({
  pendingClients: initialPendingClients,
  orders: initialOrders,
}: {
  pendingClients: PendingClient[];
  orders: Order[];
}) {
  const router = useRouter();
  const [pendingClients, setPendingClients] = useState(initialPendingClients);
  const [clientLoading, setClientLoading] = useState<string | null>(null);
  const [orders, setOrders] = useState(initialOrders);
  const [expanded, setExpanded] = useState<string | null>(initialOrders[0]?.id ?? null);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleApproveClient(clientId: string) {
    setClientLoading(clientId);
    try {
      const res = await fetch(`/api/clientes/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      if (!res.ok) throw new Error();
      setPendingClients((prev) => prev.filter((c) => c.id !== clientId));
      router.refresh();
    } finally {
      setClientLoading(null);
    }
  }

  async function handleRejectClient(clientId: string) {
    if (!confirm("Recusar este cadastro? O cliente não poderá acessar a loja.")) return;
    setClientLoading(clientId);
    try {
      await fetch(`/api/clientes/${clientId}`, {
        method: "DELETE",
      });
      setPendingClients((prev) => prev.filter((c) => c.id !== clientId));
    } finally {
      setClientLoading(null);
    }
  }

  // Per-order date picker state: orderId -> date string
  const [pendingApproval, setPendingApproval] = useState<Record<string, string>>({});

  function startApproval(orderId: string) {
    // Pre-fill with today + 1 day as default
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = tomorrow.toISOString().slice(0, 10);
    setPendingApproval((prev) => ({ ...prev, [orderId]: iso }));
  }

  function cancelApproval(orderId: string) {
    setPendingApproval((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  }

  async function handleApprove(orderId: string) {
    const scheduledDeliveryDate = pendingApproval[orderId];
    setLoading(orderId);
    try {
      const res = await fetch(`/api/pedidos/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APROVADO", scheduledDeliveryDate }),
      });
      if (!res.ok) throw new Error();
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      router.refresh();
    } catch {
      alert("Erro ao aprovar pedido.");
    } finally {
      setLoading(null);
    }
  }

  async function handleReject(orderId: string) {
    setLoading(orderId);
    try {
      const res = await fetch(`/api/pedidos/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELADO" }),
      });
      if (!res.ok) throw new Error();
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      router.refresh();
    } catch {
      alert("Erro ao recusar pedido.");
    } finally {
      setLoading(null);
    }
  }

  const pendingClientsSection = pendingClients.length > 0 && (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Cadastros pendentes</h2>
        <p className="text-sm text-gray-500">{pendingClients.length} cliente(s) aguardando liberação de acesso à loja</p>
      </div>
      {pendingClients.map((c) => (
        <Card key={c.id} className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
                <User className="h-4 w-4 text-amber-700" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{c.name ?? c.email}</p>
                <div className="flex flex-wrap gap-3 mt-0.5">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Mail className="h-3 w-3" />{c.email}
                  </span>
                  {c.phone && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Phone className="h-3 w-3" />{c.phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <CalendarDays className="h-3 w-3" />Cadastrou em {formatDate(c.createdAt)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <button
                onClick={() => handleRejectClient(c.id)}
                disabled={clientLoading === c.id}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <UserX className="h-4 w-4" />
                Recusar
              </button>
              <button
                onClick={() => handleApproveClient(c.id)}
                disabled={clientLoading === c.id}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                <UserCheck className="h-4 w-4" />
                {clientLoading === c.id ? "Aprovando..." : "Aprovar"}
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  if (orders.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Aprovações</h1>
        {pendingClientsSection}
        {pendingClients.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20">
            <CheckCircle className="mb-4 h-12 w-12 text-green-300" />
            <p className="text-gray-500">Nenhum pedido ou cadastro aguardando aprovação.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Aprovações</h1>
        <p className="text-gray-500">{orders.length} pedido(s) aguardando sua aprovação</p>
      </div>

      {pendingClientsSection}

      <div className="space-y-4">
        {orders.map((order) => {
          const total = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          const isExpanded = expanded === order.id;
          const isApproving = pendingApproval[order.id] !== undefined;

          // Split CNPJ line from notes
          const noteLines = (order.notes ?? "").split("\n");
          const cnpjLine = noteLines.find((l) => l.startsWith("CNPJ:"));
          const cnpj = cnpjLine?.replace("CNPJ:", "").trim();
          const obs = noteLines.filter((l) => !l.startsWith("CNPJ:")).join("\n").trim();

          return (
            <Card key={order.id} className="overflow-hidden">
              {/* Header row */}
              <div
                className="flex cursor-pointer items-center justify-between gap-3 p-4 hover:bg-gray-50"
                onClick={() => setExpanded(isExpanded ? null : order.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-yellow-100">
                    <Clock className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      #{order.id.slice(-6).toUpperCase()} — {order.client.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(order.createdAt)} · {order.items.length} iten(s) ·{" "}
                      <span className="font-medium text-blue-900">{formatCurrency(total)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isApproving && (
                    <>
                      <Button
                        size="sm"
                        variant="success"
                        disabled={loading === order.id}
                        onClick={(e) => { e.stopPropagation(); startApproval(order.id); }}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={loading === order.id}
                        onClick={(e) => { e.stopPropagation(); handleReject(order.id); }}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Recusar
                      </Button>
                    </>
                  )}
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-gray-400" />
                    : <ChevronDown className="h-4 w-4 text-gray-400" />
                  }
                </div>
              </div>

              {/* Date picker prompt (inline, above expanded content) */}
              {isApproving && (
                <div
                  className="border-t border-green-100 bg-green-50 px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-green-600" />
                      <p className="text-sm font-medium text-green-800">Data prevista de entrega</p>
                    </div>
                    <input
                      type="date"
                      value={pendingApproval[order.id]}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) =>
                        setPendingApproval((prev) => ({ ...prev, [order.id]: e.target.value }))
                      }
                      className="rounded-md border border-green-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        disabled={!pendingApproval[order.id] || loading === order.id}
                        onClick={() => handleApprove(order.id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        {loading === order.id ? "Aprovando..." : "Confirmar aprovação"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading === order.id}
                        onClick={() => cancelApproval(order.id)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">

                  {/* Client data */}
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Dados do Cliente
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex items-start gap-2">
                        <User className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400">Nome / Razão Social</p>
                          <p className="text-sm font-medium text-gray-900">
                            {order.client.name ?? "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400">Email</p>
                          <p className="text-sm font-medium text-gray-900">{order.client.email}</p>
                        </div>
                      </div>
                      {order.client.phone && (
                        <div className="flex items-start gap-2">
                          <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-400">Telefone</p>
                            <p className="text-sm font-medium text-gray-900">{order.client.phone}</p>
                          </div>
                        </div>
                      )}
                      {cnpj && (
                        <div className="flex items-start gap-2">
                          <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-400">CNPJ</p>
                            <p className="text-sm font-medium text-gray-900">{cnpj}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <ShoppingBag className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400">Histórico</p>
                          <p className="text-sm font-medium text-gray-900">
                            {order.client.totalOrders === 1
                              ? "1º pedido (cliente novo)"
                              : `${order.client.totalOrders} pedidos no total`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-400">Cliente desde</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(order.client.createdAt)}
                          </p>
                        </div>
                      </div>
                      {order.requestedDate && (
                        <div className="flex items-start gap-2">
                          <CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-700" />
                          <div>
                            <p className="text-xs text-gray-400">Data solicitada de entrega</p>
                            <p className="text-sm font-medium text-blue-900">
                              {formatDate(order.requestedDate)}
                            </p>
                          </div>
                        </div>
                      )}
                      {order.deliveryAddress && (
                        <div className="flex items-start gap-2 sm:col-span-2">
                          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-400">Endereço de entrega</p>
                            <p className="text-sm font-medium text-gray-900">{order.deliveryAddress}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="rounded-xl border border-gray-200 bg-white">
                    <p className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Itens do Pedido
                    </p>
                    <div className="divide-y divide-gray-100">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.product.name}</p>
                            <p className="text-xs text-gray-400">
                              {item.quantity} {item.product.unit} × {formatCurrency(item.unitPrice)}
                            </p>
                          </div>
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(item.unitPrice * item.quantity)}
                          </p>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-4 py-3">
                        <p className="font-bold text-gray-900">Total</p>
                        <p className="text-lg font-bold text-blue-900">{formatCurrency(total)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Observations */}
                  {obs && (
                    <div className="flex items-start gap-2 rounded-lg bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                      <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
                      <div>
                        <p className="font-medium">Observações</p>
                        <p className="mt-0.5 whitespace-pre-line">{obs}</p>
                      </div>
                    </div>
                  )}

                  {/* Action buttons (bottom) */}
                  {!isApproving && (
                    <div className="flex gap-3 pt-1">
                      <Button
                        className="flex-1"
                        variant="success"
                        disabled={loading === order.id}
                        onClick={() => startApproval(order.id)}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Aprovar Pedido
                      </Button>
                      <Button
                        className="flex-1"
                        variant="destructive"
                        disabled={loading === order.id}
                        onClick={() => handleReject(order.id)}
                      >
                        <XCircle className="h-4 w-4" />
                        Recusar
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
