"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, ShoppingBag, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, PAYMENT_METHOD_LABELS } from "@/lib/utils";
import Link from "next/link";

interface Client {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  category: string | null;
}

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  notes: string;
}

const selectClass =
  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2";

const STATUS_OPTIONS = [
  { value: "RASCUNHO",          label: "Rascunho (salvar sem enviar)" },
  { value: "PENDENTE_APROVACAO", label: "Aguardando aprovação" },
  { value: "APROVADO",           label: "Aprovado (pular aprovação)" },
];

export function NovoPedidoClient({
  clients,
  products,
  role,
}: {
  clients: Client[];
  products: Product[];
  role: string;
}) {
  const router = useRouter();

  const [clientId,   setClientId]   = useState("");
  const [status,     setStatus]     = useState("PENDENTE_APROVACAO");
  const [payment,    setPayment]    = useState("");
  const [reqDate,    setReqDate]    = useState("");
  const [delivDate,  setDelivDate]  = useState("");
  const [address,    setAddress]    = useState("");
  const [notes,      setNotes]      = useState("");
  const [intNotes,   setIntNotes]   = useState("");
  const [items,      setItems]      = useState<OrderItem[]>([
    { productId: "", quantity: 1, unitPrice: 0, notes: "" },
  ]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  // ── Item helpers ─────────────────────────────────────────────────────────────

  function addItem() {
    setItems((prev) => [...prev, { productId: "", quantity: 1, unitPrice: 0, notes: "" }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem<K extends keyof OrderItem>(idx: number, key: K, value: OrderItem[K]) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item))
    );
  }

  function selectProduct(idx: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, productId, unitPrice: product?.price ?? 0 }
          : item
      )
    );
  }

  // ── Total ────────────────────────────────────────────────────────────────────

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!clientId) { setError("Selecione um cliente."); return; }
    if (items.some((i) => !i.productId)) { setError("Selecione o produto em todos os itens."); return; }
    if (items.some((i) => i.quantity <= 0)) { setError("Quantidade deve ser maior que zero."); return; }
    if (items.some((i) => i.unitPrice <= 0)) { setError("Preço unitário deve ser maior que zero."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          status,
          paymentMethod:        payment || undefined,
          requestedDate:        reqDate || undefined,
          scheduledDeliveryDate: delivDate || undefined,
          deliveryAddress:      address || undefined,
          notes:                notes || undefined,
          internalNotes:        intNotes || undefined,
          items: items.map((i) => ({
            productId: i.productId,
            quantity:  i.quantity,
            unitPrice: i.unitPrice,
            notes:     i.notes || undefined,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar pedido.");
        return;
      }
      router.push(`/pedidos/${data.id}`);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  // ── Grouped products for select ──────────────────────────────────────────────

  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category ?? "Sem Categoria";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/pedidos"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para pedidos
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
            <ShoppingBag className="h-5 w-5 text-blue-800" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Novo Pedido Manual</h1>
            <p className="text-sm text-gray-400">Crie um pedido em nome de um cliente</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        {/* ── Left: items ── */}
        <div className="space-y-4 lg:col-span-2">

          {/* Client + Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações do pedido</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="client">Cliente *</Label>
                <select
                  id="client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className={selectClass}
                  required
                >
                  <option value="">Selecione o cliente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name ?? c.email} — {c.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="status">Status inicial</Label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={selectClass}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payment">Forma de pagamento</Label>
                <select
                  id="payment"
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Não definida</option>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reqDate">Data solicitada</Label>
                <Input
                  id="reqDate"
                  type="date"
                  value={reqDate}
                  onChange={(e) => setReqDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="delivDate">Previsão de entrega</Label>
                <Input
                  id="delivDate"
                  type="date"
                  value={delivDate}
                  onChange={(e) => setDelivDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="address">Endereço de entrega</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, bairro, cidade..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Itens do pedido *</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3"
                >
                  {/* Product */}
                  <div className="space-y-1 col-span-4 sm:col-span-1">
                    <label className="text-xs font-medium text-gray-500">Produto</label>
                    <select
                      value={item.productId}
                      onChange={(e) => selectProduct(idx, e.target.value)}
                      className={selectClass}
                      required
                    >
                      <option value="">Selecione...</option>
                      {Object.entries(grouped).map(([cat, prods]) => (
                        <optgroup key={cat} label={cat}>
                          {prods.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.unit}) — {formatCurrency(p.price)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="space-y-1 w-24">
                    <label className="text-xs font-medium text-gray-500">Qtd</label>
                    <Input
                      type="number"
                      min={0.001}
                      step="any"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                      className="text-center"
                    />
                  </div>

                  {/* Unit price */}
                  <div className="space-y-1 w-28">
                    <label className="text-xs font-medium text-gray-500">Preço unit.</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                      <Input
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="pl-7"
                      />
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                    className="mb-0.5 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  {/* Subtotal */}
                  {item.productId && (
                    <div className="col-span-4 flex items-center justify-between px-1">
                      <span className="text-xs text-gray-400">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </span>
                      <span className="text-sm font-semibold text-gray-700">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </span>
                    </div>
                  )}

                  {/* Item notes */}
                  <div className="col-span-4 space-y-1">
                    <label className="text-xs font-medium text-gray-500">Obs. do item (opcional)</label>
                    <Input
                      value={item.notes}
                      onChange={(e) => updateItem(idx, "notes", e.target.value)}
                      placeholder="Ex: fatiar, sem casca..."
                      className="text-sm"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addItem}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-2.5 text-sm font-medium text-gray-500 transition hover:border-blue-300 hover:text-blue-700"
              >
                <Plus className="h-4 w-4" />
                Adicionar item
              </button>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Observações</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="notes">Obs. do cliente</Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Visível para o cliente..."
                  className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2 resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="intNotes">Obs. internas</Label>
                <textarea
                  id="intNotes"
                  value={intNotes}
                  onChange={(e) => setIntNotes(e.target.value)}
                  rows={3}
                  placeholder="Apenas para a equipe..."
                  className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2 resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: summary + submit ── */}
        <div className="space-y-4">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items summary */}
              <div className="space-y-1.5">
                {items.filter((i) => i.productId).map((item, idx) => {
                  const prod = products.find((p) => p.id === item.productId);
                  return (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 truncate flex-1 mr-2">
                        {prod?.name ?? "—"} × {item.quantity}
                      </span>
                      <span className="font-medium text-gray-900 shrink-0">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {items.some((i) => i.productId) && (
                <>
                  <div className="border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-700">Total</span>
                      <span className="text-xl font-bold text-blue-900">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Status badge */}
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <span className="font-medium">Status: </span>
                {STATUS_OPTIONS.find((s) => s.value === status)?.label}
              </div>

              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Criando pedido...
                  </>
                ) : (
                  "Criar pedido"
                )}
              </Button>

              <Link
                href="/pedidos"
                className="block w-full rounded-lg border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </Link>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
