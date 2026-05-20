"use client";

import { useState, useOptimistic } from "react";
import {
  Plus, Trash2, ChevronRight, ChevronLeft, X, Calendar,
  PackageCheck, Truck, Factory, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Tipos ──────────────────────────────────────────────────────────────────────

type Status = "SOLICITADO" | "EM_PRODUCAO" | "A_CAMINHO" | "RECEBIDO";

interface FactoryOrder {
  id:         string;
  title:      string;
  quantity:   string | null;
  notes:      string | null;
  expectedAt: string | Date | null;
  status:     Status;
  createdAt:  string | Date;
}

// ── Config das colunas ─────────────────────────────────────────────────────────

const COLUMNS: { status: Status; label: string; icon: React.ElementType; color: string; bg: string; border: string }[] = [
  {
    status: "SOLICITADO",
    label:  "Solicitado",
    icon:   ClipboardList,
    color:  "text-blue-700",
    bg:     "bg-blue-50",
    border: "border-blue-200",
  },
  {
    status: "EM_PRODUCAO",
    label:  "Em Produção",
    icon:   Factory,
    color:  "text-orange-700",
    bg:     "bg-orange-50",
    border: "border-orange-200",
  },
  {
    status: "A_CAMINHO",
    label:  "A Caminho",
    icon:   Truck,
    color:  "text-purple-700",
    bg:     "bg-purple-50",
    border: "border-purple-200",
  },
  {
    status: "RECEBIDO",
    label:  "Recebido",
    icon:   PackageCheck,
    color:  "text-green-700",
    bg:     "bg-green-50",
    border: "border-green-200",
  },
];

const STATUS_ORDER: Status[] = ["SOLICITADO", "EM_PRODUCAO", "A_CAMINHO", "RECEBIDO"];

function fmtDate(d: string | Date | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// ── Modal de criação / edição ──────────────────────────────────────────────────

interface FormState { title: string; quantity: string; notes: string; expectedAt: string }
const EMPTY: FormState = { title: "", quantity: "", notes: "", expectedAt: "" };

function OrderModal({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial?: Partial<FormState>;
  onSave: (f: FormState) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>({ ...EMPTY, ...initial });
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-gray-900">
            {initial?.title ? "Editar pedido" : "Novo pedido para a fábrica"}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Produto / Descrição *</label>
            <input
              autoFocus
              value={form.title}
              onChange={set("title")}
              className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
              placeholder="Ex: Pão Francês"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Quantidade</label>
              <input
                value={form.quantity}
                onChange={set("quantity")}
                className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
                placeholder="Ex: 500 un"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Previsão de entrega</label>
              <input
                type="date"
                value={form.expectedAt}
                onChange={set("expectedAt")}
                className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Observações</label>
            <textarea
              value={form.notes}
              onChange={set("notes")}
              rows={2}
              className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 resize-none"
              placeholder="Detalhes, sabores, especificações..."
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <Button
            onClick={() => onSave(form)}
            disabled={saving || !form.title.trim()}
            className="flex-1"
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}

// ── Card do Kanban ─────────────────────────────────────────────────────────────

function KanbanCard({
  order,
  colIndex,
  onMove,
  onEdit,
  onDelete,
  moving,
}: {
  order:    FactoryOrder;
  colIndex: number;
  onMove:   (id: string, dir: -1 | 1) => void;
  onEdit:   (o: FactoryOrder) => void;
  onDelete: (id: string) => void;
  moving:   boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm space-y-2 group">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 leading-tight">{order.title}</p>
        <button
          onClick={() => onDelete(order.id)}
          className="mt-0.5 flex-shrink-0 rounded p-0.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {order.quantity && (
        <p className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">{order.quantity}</span>
        </p>
      )}

      {order.expectedAt && (
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Calendar className="h-3 w-3" />
          Previsão: {fmtDate(order.expectedAt)}
        </div>
      )}

      {order.notes && (
        <p className="text-xs text-gray-400 italic line-clamp-2">{order.notes}</p>
      )}

      {/* Ações */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => onEdit(order)}
          className="text-xs text-blue-600 hover:underline"
        >
          Editar
        </button>
        <div className="flex gap-1">
          <button
            onClick={() => onMove(order.id, -1)}
            disabled={colIndex === 0 || moving}
            className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-700 disabled:opacity-30"
            title="Mover para coluna anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onMove(order.id, 1)}
            disabled={colIndex === STATUS_ORDER.length - 1 || moving}
            className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-700 disabled:opacity-30"
            title="Avançar para próxima coluna"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export function FabricaKanban({ initial }: { initial: FactoryOrder[] }) {
  const [orders, setOrders] = useOptimistic<FactoryOrder[]>(initial);
  const [showModal, setShowModal]   = useState(false);
  const [editing,   setEditing]     = useState<FactoryOrder | null>(null);
  const [saving,    setSaving]      = useState(false);
  const [movingId,  setMovingId]    = useState<string | null>(null);

  // ── Criar ──
  async function handleCreate(form: FormState) {
    setSaving(true);
    try {
      const res = await fetch("/api/fabrica/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:      form.title.trim(),
          quantity:   form.quantity.trim() || null,
          notes:      form.notes.trim()    || null,
          expectedAt: form.expectedAt      || null,
        }),
      });
      if (!res.ok) { alert("Erro ao criar pedido."); return; }
      const created: FactoryOrder = await res.json();
      setOrders((prev) => [...prev, created]);
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }

  // ── Editar ──
  async function handleEdit(form: FormState) {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/fabrica/pedidos/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:      form.title.trim(),
          quantity:   form.quantity.trim() || null,
          notes:      form.notes.trim()    || null,
          expectedAt: form.expectedAt      || null,
        }),
      });
      if (!res.ok) { alert("Erro ao salvar."); return; }
      const updated: FactoryOrder = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  // ── Mover coluna ──
  async function handleMove(id: string, dir: -1 | 1) {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    const idx       = STATUS_ORDER.indexOf(order.status);
    const newStatus = STATUS_ORDER[idx + dir];
    if (!newStatus) return;

    setMovingId(id);
    // Optimistic update
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o))
    );

    try {
      await fetch(`/api/fabrica/pedidos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // rollback on error
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: order.status } : o))
      );
    } finally {
      setMovingId(null);
    }
  }

  // ── Apagar ──
  async function handleDelete(id: string) {
    if (!confirm("Apagar este pedido?")) return;
    setOrders((prev) => prev.filter((o) => o.id !== id));
    await fetch(`/api/fabrica/pedidos/${id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-4">
      {/* Header da seção */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Pedidos Feitos para a Fábrica</h2>
          <p className="text-sm text-gray-500">Acompanhe o status de cada pedido enviado ao fornecedor</p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" />
          Novo pedido
        </Button>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col, colIndex) => {
          const Icon  = col.icon;
          const cards = orders.filter((o) => o.status === col.status);
          return (
            <div key={col.status} className={`rounded-2xl border ${col.border} ${col.bg} p-3`}>
              {/* Cabeçalho da coluna */}
              <div className={`mb-3 flex items-center gap-2 ${col.color}`}>
                <Icon className="h-4 w-4" />
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-white/70 px-1.5 text-xs font-bold">
                  {cards.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2 min-h-[80px]">
                {cards.map((order) => (
                  <KanbanCard
                    key={order.id}
                    order={order}
                    colIndex={colIndex}
                    onMove={handleMove}
                    onEdit={setEditing}
                    onDelete={handleDelete}
                    moving={movingId === order.id}
                  />
                ))}
                {cards.length === 0 && (
                  <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-current/20 text-xs text-current/40">
                    Vazio
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal criar */}
      {showModal && (
        <OrderModal
          onSave={handleCreate}
          onClose={() => setShowModal(false)}
          saving={saving}
        />
      )}

      {/* Modal editar */}
      {editing && (
        <OrderModal
          initial={{
            title:      editing.title,
            quantity:   editing.quantity ?? "",
            notes:      editing.notes    ?? "",
            expectedAt: editing.expectedAt
              ? new Date(editing.expectedAt).toISOString().slice(0, 10)
              : "",
          }}
          onSave={handleEdit}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
