"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  XCircle,
  Factory,
  Truck,
  Package,
  Clock,
  ArrowLeft,
  DollarSign,
  Pencil,
  Check,
  X,
  ExternalLink,
  FileText,
  AlertCircle,
  Copy,
  Link2,
  Download,
  Ban,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/utils";
import type { OrderStatus, InvoiceStatus } from "@/app/generated/prisma/client";
import Link from "next/link";

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  notes: string | null;
  product: { name: string; unit: string };
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  installments: number;
  installmentN: number;
  dueDate: Date;
  paidAt: Date | null;
  status: string;
}

interface Invoice {
  id:          string;
  number:      string | null;
  status:      InvoiceStatus;
  pdfUrl:      string | null;
  xmlUrl:      string | null;
  accessKey:   string | null;
  issuedAt:    Date | null;
  focusNfeRef: string | null;
  errorMsg:    string | null;
}

interface Order {
  id: string;
  status: OrderStatus;
  notes: string | null;
  internalNotes: string | null;
  paymentMethod: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  scheduledDeliveryDate: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  requestedDate: Date | null;
  client: { id: string; name: string | null; email: string };
  approvedBy: { name: string | null } | null;
  items: OrderItem[];
  payments: Payment[];
  invoices: Invoice[];
}

const STATUS_FLOW: OrderStatus[] = [
  "PENDENTE_APROVACAO",
  "APROVADO",
  "EM_PRODUCAO",
  "PRONTO",
  "EM_ENTREGA",
  "ENTREGUE",
];

const NEXT_STATUS_ACTIONS: Partial<
  Record<OrderStatus, { label: string; nextStatus: OrderStatus; variant: "default" | "success" | "destructive" }>
> = {
  PENDENTE_APROVACAO: {
    label: "Aprovar Pedido",
    nextStatus: "APROVADO",
    variant: "success",
  },
  APROVADO: {
    label: "Iniciar Produção",
    nextStatus: "EM_PRODUCAO",
    variant: "default",
  },
  EM_PRODUCAO: {
    label: "Marcar como Pronto",
    nextStatus: "PRONTO",
    variant: "default",
  },
  PRONTO: {
    label: "Saiu para Entrega",
    nextStatus: "EM_ENTREGA",
    variant: "default",
  },
  EM_ENTREGA: {
    label: "Confirmar Entrega",
    nextStatus: "ENTREGUE",
    variant: "success",
  },
};

const ROLE_CAN_ADVANCE: Record<string, OrderStatus[]> = {
  TENANT_ADMIN: ["APROVADO", "EM_PRODUCAO", "PRONTO", "EM_ENTREGA", "ENTREGUE"],
  GERENTE: ["APROVADO"],
  OPERADOR: ["EM_PRODUCAO", "PRONTO", "EM_ENTREGA", "ENTREGUE"],
  CLIENTE: [],
};

interface OrderDetailClientProps {
  order: Order;
  role: string;
  showPrice: boolean;
}

export function OrderDetailClient({
  order,
  role,
  showPrice,
}: OrderDetailClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mpLoading, setMpLoading] = useState<Record<string, boolean>>({});
  const [mpLinks,   setMpLinks]   = useState<Record<string, string>>({});
  const [copied,    setCopied]    = useState<Record<string, boolean>>({});
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState(
    order.scheduledDeliveryDate
      ? new Date(order.scheduledDeliveryDate).toISOString().slice(0, 10)
      : ""
  );
  const [savingDate, setSavingDate] = useState(false);

  const canEditDate = ["TENANT_ADMIN", "SUPER_ADMIN", "GERENTE"].includes(role) &&
    !["ENTREGUE", "CANCELADO"].includes(order.status);

  async function saveDeliveryDate() {
    setSavingDate(true);
    try {
      const res = await fetch(`/api/pedidos/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDeliveryDate: dateValue || null }),
      });
      if (!res.ok) throw new Error();
      setEditingDate(false);
      router.refresh();
    } catch {
      alert("Erro ao salvar data.");
    } finally {
      setSavingDate(false);
    }
  }

  const canUseMp  = ["TENANT_ADMIN", "SUPER_ADMIN", "GERENTE"].includes(role);
  const canUseNfe = ["TENANT_ADMIN", "SUPER_ADMIN", "GERENTE"].includes(role);

  const [chargeMethod, setChargeMethod] = useState(
    order.paymentMethod ?? "PIX"
  );
  const [generatingCharge, setGeneratingCharge] = useState(false);

  async function generateCharge() {
    setGeneratingCharge(true);
    try {
      const res = await fetch(`/api/pedidos/${order.id}/cobrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: chargeMethod }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Erro ao gerar cobrança.");
        return;
      }
      router.refresh();
      if (data.checkoutUrl) {
        setMpLinks((prev) => ({ ...prev, [data.paymentId]: data.checkoutUrl }));
      }
    } catch {
      alert("Erro de conexão ao gerar cobrança.");
    } finally {
      setGeneratingCharge(false);
    }
  }

  const [emittingNfe, setEmittingNfe] = useState(false);
  const [nfeError,    setNfeError]    = useState<{ message: string; missing?: string[] } | null>(null);

  // Cancelamento de NF-e
  const [cancellingId,   setCancellingId]   = useState<string | null>(null); // invoiceId em cancelamento
  const [cancelJust,     setCancelJust]     = useState("");
  const [cancelLoading,  setCancelLoading]  = useState(false);
  const [cancelError,    setCancelError]    = useState("");

  async function generateMpLink(paymentId: string) {
    setMpLoading((prev) => ({ ...prev, [paymentId]: true }));
    try {
      const res = await fetch(`/api/pagamentos/${paymentId}/mp-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Erro ao gerar link de pagamento.");
        return;
      }
      setMpLinks((prev) => ({ ...prev, [paymentId]: data.checkoutUrl }));
    } catch {
      alert("Erro de conexão ao gerar link.");
    } finally {
      setMpLoading((prev) => ({ ...prev, [paymentId]: false }));
    }
  }

  async function copyLink(paymentId: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied((prev) => ({ ...prev, [paymentId]: true }));
      setTimeout(() => setCopied((prev) => ({ ...prev, [paymentId]: false })), 2500);
    } catch {
      prompt("Copie o link abaixo:", url);
    }
  }

  async function emitirNfe() {
    setEmittingNfe(true);
    setNfeError(null);
    try {
      const res  = await fetch(`/api/pedidos/${order.id}/emitir-nfe`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setNfeError({ message: data.error ?? "Erro ao emitir NF-e.", missing: data.missing });
        return;
      }
      router.refresh();
    } catch {
      setNfeError({ message: "Erro de conexão." });
    } finally {
      setEmittingNfe(false);
    }
  }

  async function cancelarNfe(invoiceId: string) {
    setCancelLoading(true);
    setCancelError("");
    try {
      const res = await fetch(`/api/pedidos/${order.id}/cancelar-nfe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, justificativa: cancelJust }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCancelError(data.error ?? "Erro ao cancelar NF-e.");
        return;
      }
      setCancellingId(null);
      setCancelJust("");
      router.refresh();
    } catch {
      setCancelError("Erro de conexão.");
    } finally {
      setCancelLoading(false);
    }
  }

  const total = order.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  const currentIdx = STATUS_FLOW.indexOf(order.status as OrderStatus);
  const nextAction =
    order.status !== "CANCELADO" && order.status !== "ENTREGUE"
      ? NEXT_STATUS_ACTIONS[order.status]
      : undefined;

  const canAdvance =
    nextAction &&
    (ROLE_CAN_ADVANCE[role]?.includes(nextAction.nextStatus) ?? false);
  const canCancel =
    !["ENTREGUE", "CANCELADO"].includes(order.status) &&
    ["TENANT_ADMIN", "GERENTE"].includes(role);

  async function updateStatus(
    newStatus: OrderStatus,
    cancelReason?: string
  ) {
    setLoading(true);
    try {
      const res = await fetch(`/api/pedidos/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          ...(cancelReason ? { cancelReason } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Erro ao atualizar pedido.");
        return;
      }
      router.refresh();
    } catch {
      alert("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    const reason = prompt("Motivo do cancelamento:");
    if (reason !== null) {
      updateStatus("CANCELADO", reason);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/pedidos"
            className="mb-2 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para pedidos
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Pedido #{order.id.slice(-6).toUpperCase()}
            </h1>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ORDER_STATUS_COLORS[order.status]}`}
            >
              {ORDER_STATUS_LABELS[order.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Criado em {formatDateTime(order.createdAt)} — Cliente:{" "}
            {order.client.name}
          </p>
        </div>
        <div className="flex gap-2">
          {canAdvance && nextAction && (
            <Button
              variant={nextAction.variant}
              onClick={() => updateStatus(nextAction.nextStatus)}
              disabled={loading}
            >
              {loading ? "..." : nextAction.label}
            </Button>
          )}
          {canCancel && (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {order.status !== "CANCELADO" && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-0">
            {STATUS_FLOW.map((s, i) => {
              const isDone = currentIdx >= i;
              const isCurrent = currentIdx === i;
              const StatusIcon =
                s === "ENTREGUE"
                  ? CheckCircle
                  : s === "EM_PRODUCAO"
                  ? Factory
                  : s === "EM_ENTREGA"
                  ? Truck
                  : s === "APROVADO"
                  ? CheckCircle
                  : s === "PRONTO"
                  ? Package
                  : Clock;

              return (
                <div key={s} className="flex flex-1 flex-col items-center">
                  <div className="relative flex items-center w-full">
                    {i > 0 && (
                      <div
                        className={`h-0.5 flex-1 ${
                          isDone ? "bg-blue-700" : "bg-gray-200"
                        }`}
                      />
                    )}
                    <div
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        isDone
                          ? "border-blue-700 bg-blue-700 text-white"
                          : "border-gray-200 bg-white text-gray-300"
                      } ${isCurrent ? "ring-2 ring-blue-200 ring-offset-1" : ""}`}
                    >
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    {i < STATUS_FLOW.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 ${
                          currentIdx > i ? "bg-blue-700" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                  <p
                    className={`mt-1 hidden text-center text-xs sm:block ${
                      isCurrent
                        ? "font-semibold text-blue-900"
                        : isDone
                        ? "text-blue-800"
                        : "text-gray-400"
                    }`}
                  >
                    {ORDER_STATUS_LABELS[s]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order items */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Itens do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-6 py-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {item.product.name}
                      </p>
                      <p className="text-sm text-gray-400">
                        {item.quantity} {item.product.unit}
                        {showPrice &&
                          ` × ${formatCurrency(item.unitPrice)}`}
                      </p>
                    </div>
                    {showPrice ? (
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">
                        Aguardando aprovação
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {showPrice && (
                <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
                  <p className="font-semibold text-gray-900">Total</p>
                  <p className="text-xl font-bold text-blue-900">
                    {formatCurrency(total)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Observações do Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{order.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Payments */}
          {showPrice && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4" />
                  Pagamentos
                </CardTitle>
              </CardHeader>

              {order.payments.length > 0 ? (
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-100">
                    {order.payments.map((p) => (
                      <div key={p.id}>
                        <div className="flex items-center justify-between px-6 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {p.installments > 1
                                ? `Parcela ${p.installmentN}/${p.installments}`
                                : "Pagamento único"}{" "}
                              — {PAYMENT_METHOD_LABELS[p.method] ?? p.method.replace(/_/g, " ")}
                            </p>
                            <p className="text-xs text-gray-400">
                              Vence: {formatDateTime(p.dueDate)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-semibold">{formatCurrency(p.amount)}</p>
                              <span
                                className={`text-xs font-medium ${
                                  p.status === "PAGO"
                                    ? "text-green-600"
                                    : p.status === "VENCIDO"
                                    ? "text-red-600"
                                    : "text-yellow-600"
                                }`}
                              >
                                {p.status}
                              </span>
                            </div>
                            {canUseMp && p.status !== "PAGO" && (
                              <button
                                onClick={() => generateMpLink(p.id)}
                                disabled={mpLoading[p.id]}
                                title="Gerar link de pagamento no Mercado Pago"
                                className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                              >
                                {mpLoading[p.id] ? (
                                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                                ) : (
                                  <Link2 className="h-3.5 w-3.5" />
                                )}
                                {mpLoading[p.id] ? "Gerando..." : "Gerar link MP"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Link panel — appears after generating */}
                        {mpLinks[p.id] && (
                          <div className="mx-4 mb-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
                            <p className="mb-1.5 text-xs font-semibold text-blue-800">
                              Link de pagamento gerado
                            </p>
                            <div className="flex items-center gap-2">
                              <input
                                readOnly
                                value={mpLinks[p.id]}
                                className="flex-1 truncate rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none"
                              />
                              <button
                                onClick={() => copyLink(p.id, mpLinks[p.id])}
                                className="flex items-center gap-1 rounded-lg bg-blue-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900"
                              >
                                {copied[p.id] ? (
                                  <><Check className="h-3.5 w-3.5" />Copiado!</>
                                ) : (
                                  <><Copy className="h-3.5 w-3.5" />Copiar</>
                                )}
                              </button>
                              <a
                                href={mpLinks[p.id]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-blue-200 bg-white p-1.5 text-blue-700 hover:bg-blue-100"
                                title="Abrir link"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              ) : (
                /* No payments yet — show charge generation */
                <CardContent>
                  {canUseMp && !["CANCELADO", "RASCUNHO"].includes(order.status) ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500">
                        Nenhuma cobrança registrada. Gere o link de pagamento para o cliente.
                      </p>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600">
                          Forma de pagamento
                        </label>
                        <select
                          value={chargeMethod}
                          onChange={(e) => setChargeMethod(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-1"
                        >
                          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={generateCharge}
                        disabled={generatingCharge}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-800 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:opacity-50"
                      >
                        {generatingCharge ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                        {generatingCharge ? "Gerando cobrança..." : "Cobrar via Mercado Pago"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">
                      Nenhum pagamento registrado.
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
          )}
        </div>

        {/* Side info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Cliente
                </p>
                <p className="text-sm text-gray-900">{order.client.name}</p>
                <p className="text-xs text-gray-400">{order.client.email}</p>
              </div>
              {order.approvedAt && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Aprovado em
                  </p>
                  <p className="text-sm text-gray-900">
                    {formatDateTime(order.approvedAt)}
                  </p>
                  {order.approvedBy && (
                    <p className="text-xs text-gray-400">
                      por {order.approvedBy.name}
                    </p>
                  )}
                </div>
              )}
              <div className="rounded-lg bg-blue-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-800">
                    Previsão de entrega
                  </p>
                  {canEditDate && !editingDate && (
                    <button
                      onClick={() => setEditingDate(true)}
                      className="rounded p-0.5 text-blue-700 hover:bg-blue-100"
                      title="Editar data"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {editingDate ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="date"
                      value={dateValue}
                      onChange={(e) => setDateValue(e.target.value)}
                      className="rounded border border-blue-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={saveDeliveryDate}
                      disabled={savingDate}
                      className="rounded bg-blue-800 p-1 text-white hover:bg-blue-900 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingDate(false);
                        setDateValue(
                          order.scheduledDeliveryDate
                            ? new Date(order.scheduledDeliveryDate).toISOString().slice(0, 10)
                            : ""
                        );
                      }}
                      className="rounded border border-gray-300 bg-white p-1 text-gray-500 hover:bg-gray-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="mt-0.5 text-base font-bold text-blue-900">
                    {order.scheduledDeliveryDate
                      ? formatDate(order.scheduledDeliveryDate)
                      : <span className="text-sm font-normal text-blue-700 italic">Não definida</span>
                    }
                  </p>
                )}
              </div>
              {order.deliveredAt && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Entregue em
                  </p>
                  <p className="text-sm text-gray-900">
                    {formatDateTime(order.deliveredAt)}
                  </p>
                </div>
              )}
              {order.cancelledAt && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    Cancelado em
                  </p>
                  <p className="text-sm text-red-600">
                    {formatDateTime(order.cancelledAt)}
                  </p>
                  {order.cancelReason && (
                    <p className="text-xs text-gray-400">{order.cancelReason}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notas Fiscais */}
          {showPrice && canUseNfe && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-green-600" />
                  Nota Fiscal (NF-e)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* NF-es existentes */}
                {order.invoices.map((inv) => (
                  <div key={inv.id} className="space-y-2">
                    <div
                      className={`rounded-lg px-3 py-2.5 ${
                        inv.status === "EMITIDA"   ? "bg-green-50 border border-green-200"
                        : inv.status === "CANCELADA" ? "bg-gray-50 border border-gray-200"
                        : inv.status === "ERRO"      ? "bg-red-50 border border-red-200"
                        : "bg-yellow-50 border border-yellow-200"
                      }`}
                    >
                      {/* Linha principal */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {inv.number ? `NF-e nº ${inv.number}` : "NF-e em processamento"}
                          </p>
                          <p className={`text-xs font-semibold ${
                            inv.status === "EMITIDA"    ? "text-green-700"
                            : inv.status === "CANCELADA" ? "text-gray-500"
                            : inv.status === "ERRO"      ? "text-red-600"
                            : "text-yellow-700"
                          }`}>
                            {inv.status === "EMITIDA"    ? `✓ Emitida${inv.issuedAt ? ` · ${formatDate(inv.issuedAt)}` : ""}`
                             : inv.status === "CANCELADA" ? "✕ Cancelada"
                             : inv.status === "ERRO"      ? "✕ Erro na emissão"
                             : "⏳ Processando..."}
                          </p>
                          {inv.status === "ERRO" && inv.errorMsg && (
                            <p className="mt-0.5 text-xs text-red-500">{inv.errorMsg}</p>
                          )}
                          {inv.accessKey && (
                            <p className="mt-0.5 truncate text-xs text-gray-400 font-mono">
                              {inv.accessKey}
                            </p>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          {inv.pdfUrl && (
                            <a
                              href={inv.pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 rounded border border-green-200 bg-white px-2 py-1 text-xs text-green-700 hover:bg-green-50"
                            >
                              <Download className="h-3 w-3" />
                              DANFe
                            </a>
                          )}
                          {inv.xmlUrl && (
                            <a
                              href={inv.xmlUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                            >
                              <Download className="h-3 w-3" />
                              XML
                            </a>
                          )}
                          {inv.status === "EMITIDA" && canUseNfe && (
                            <button
                              onClick={() => {
                                setCancellingId(inv.id);
                                setCancelJust("");
                                setCancelError("");
                              }}
                              className="flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            >
                              <Ban className="h-3 w-3" />
                              Cancelar NF-e
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Formulário de justificativa de cancelamento */}
                      {cancellingId === inv.id && (
                        <div className="mt-3 space-y-2 rounded-lg border border-red-200 bg-white p-3">
                          <p className="text-xs font-semibold text-red-700">
                            Justificativa de cancelamento
                          </p>
                          <textarea
                            value={cancelJust}
                            onChange={(e) => setCancelJust(e.target.value)}
                            rows={2}
                            placeholder="Mínimo 15 caracteres. Ex: Pedido cancelado a pedido do cliente."
                            className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
                          />
                          <p className={`text-xs ${cancelJust.length >= 15 ? "text-green-600" : "text-gray-400"}`}>
                            {cancelJust.length} / 15 caracteres mínimos
                          </p>
                          {cancelError && (
                            <p className="text-xs text-red-600">{cancelError}</p>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => cancelarNfe(inv.id)}
                              disabled={cancelLoading || cancelJust.length < 15}
                              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {cancelLoading
                                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                : <Ban className="h-3.5 w-3.5" />}
                              {cancelLoading ? "Cancelando..." : "Confirmar cancelamento"}
                            </button>
                            <button
                              onClick={() => { setCancellingId(null); setCancelJust(""); setCancelError(""); }}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                            >
                              Voltar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sugestão de re-emissão após cancelamento */}
                    {inv.status === "CANCELADA" && canUseNfe && (
                      <div className="flex items-center gap-2 rounded-lg border border-dashed border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                        <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                        Nota cancelada. Use o botão abaixo para emitir uma nova NF-e.
                      </div>
                    )}
                  </div>
                ))}

                {/* Erro de validação */}
                {nfeError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      <div>
                        <p className="text-sm font-medium text-red-700">{nfeError.message}</p>
                        {nfeError.missing && nfeError.missing.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {nfeError.missing.map((m) => (
                              <li key={m} className="text-xs text-red-600">• {m}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Botão de emissão — só aparece se não há NF-e emitida/processando */}
                {!order.invoices.some(
                  (i) => i.status === "EMITIDA" || i.status === "PROCESSANDO",
                ) && (
                  <button
                    onClick={emitirNfe}
                    disabled={emittingNfe}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 py-2.5 text-sm font-medium text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                  >
                    {emittingNfe ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    {emittingNfe ? "Emitindo NF-e..." : "Emitir NF-e"}
                  </button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
