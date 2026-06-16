"use client";

import { useState } from "react";
import {
  Plus, X, ChevronRight, ChevronLeft, Trash2,
  Phone, Mail, MessageCircle, User, StickyNote,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrmCardClient {
  id: string;
  name: string | null;
  nomeFantasia: string | null;
  email: string;
  phone: string | null;
}

interface CrmCard {
  id: string;
  tab: string;
  stage: string;
  leadName: string | null;
  leadPhone: string | null;
  leadEmail: string | null;
  leadSource: string | null;
  notes: string | null;
  clientId: string | null;
  client: CrmCardClient | null;
  createdAt: string;
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const NOVOS_STAGES = [
  { key: "PRIMEIRO_CONTATO",    label: "Primeiro Contato",  color: "bg-blue-100 border-blue-300",   dot: "bg-blue-400" },
  { key: "ENVIO_AMOSTRA",       label: "Envio de Amostra",  color: "bg-amber-100 border-amber-300",  dot: "bg-amber-400" },
  { key: "NEGOCIACAO",          label: "Negociação",         color: "bg-purple-100 border-purple-300", dot: "bg-purple-400" },
  { key: "FECHADO",             label: "Fechado ✓",          color: "bg-green-100 border-green-300",  dot: "bg-green-400" },
];

const POS_VENDA_STAGES = [
  { key: "PESQUISA_SATISFACAO",  label: "Pesquisa de Satisfação", color: "bg-cyan-100 border-cyan-300",    dot: "bg-cyan-400" },
  { key: "VERIFICACAO_ESTOQUE",  label: "Verificação de Estoque", color: "bg-orange-100 border-orange-300", dot: "bg-orange-400" },
  { key: "RECOMPROU",            label: "Recomprou 🎉",            color: "bg-green-100 border-green-300",  dot: "bg-green-500" },
];

// WhatsApp messages per stage
const STAGE_WA_MESSAGES: Record<string, string> = {
  PRIMEIRO_CONTATO:   "Olá {nome}! Somos da Casa do Pão, distribuidora de pães artesanais. Podemos apresentar nossos produtos?",
  ENVIO_AMOSTRA:      "Olá {nome}! Enviamos uma amostra dos nossos produtos para vocês. Já receberam?",
  NEGOCIACAO:         "Olá {nome}! Gostaria de fechar parceria com nossa distribuidora. Posso te passar nossas condições?",
  FECHADO:            "Olá {nome}! Bem-vindo(a) como cliente da Casa do Pão! Já pode fazer seu primeiro pedido.",
  PESQUISA_SATISFACAO: "Olá {nome}! Como foi a experiência com nossos produtos? Ficou satisfeito(a) com a qualidade e a entrega?",
  VERIFICACAO_ESTOQUE: "Olá {nome}! Seu estoque de pães está chegando ao fim? Posso preparar um novo pedido para você?",
  RECOMPROU:          "Olá {nome}! Obrigado pela fidelidade! Seu pedido está sendo preparado com carinho. 🍞",
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function cardDisplayName(card: CrmCard) {
  return card.client?.nomeFantasia ?? card.client?.name ?? card.leadName ?? "—";
}

function cardPhone(card: CrmCard) {
  return card.client?.phone ?? card.leadPhone ?? null;
}

// ─── New card form ─────────────────────────────────────────────────────────────

function NewCardForm({ onAdd, onClose }: { onAdd: (card: CrmCard) => void; onClose: () => void }) {
  const [name,   setName]   = useState("");
  const [phone,  setPhone]  = useState("");
  const [email,  setEmail]  = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/crm/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadName: name, leadPhone: phone, leadEmail: email, leadSource: source }),
    });
    if (res.ok) {
      const card = await res.json();
      onAdd(card);
      onClose();
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Novo Lead</h3>
            <button onClick={onClose}><X className="h-4 w-4 text-gray-400" /></button>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do lead ou empresa" autoFocus />
            </div>
            <div className="space-y-1">
              <Label>WhatsApp</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-1">
              <Label>Origem</Label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="indicação, instagram, loja..." />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Salvando..." : "Adicionar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Card detail panel ────────────────────────────────────────────────────────

function CardPanel({
  card,
  allStages,
  zapiConfigured,
  onUpdate,
  onDelete,
  onClose,
}: {
  card: CrmCard;
  allStages: { key: string; label: string }[];
  zapiConfigured: boolean;
  onUpdate: (updated: CrmCard) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [notes,   setNotes]   = useState(card.notes ?? "");
  const [saving,  setSaving]  = useState(false);
  const [waSending, setWaSending] = useState(false);
  const [waMsg,   setWaMsg]   = useState(
    STAGE_WA_MESSAGES[card.stage]?.replace("{nome}", cardDisplayName(card)) ?? ""
  );

  async function moveStage(newStage: string) {
    setSaving(true);
    const res = await fetch(`/api/crm/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
    if (res.ok) {
      const updated = await res.json();
      onUpdate(updated);
      // Update WA message for new stage
      setWaMsg(STAGE_WA_MESSAGES[updated.stage]?.replace("{nome}", cardDisplayName(updated)) ?? "");
    }
    setSaving(false);
  }

  async function saveNotes() {
    setSaving(true);
    const res = await fetch(`/api/crm/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (res.ok) onUpdate(await res.json());
    setSaving(false);
  }

  async function sendWhatsApp() {
    const phone = cardPhone(card);
    if (!phone || !waMsg.trim()) return;
    setWaSending(true);
    await fetch("/api/zapi/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: waMsg,
        recipients: [{ clientId: card.id, phone, nome: cardDisplayName(card), nomeFantasia: cardDisplayName(card) }],
      }),
    });
    setWaSending(false);
  }

  async function handleDelete() {
    if (!confirm("Remover este card do CRM?")) return;
    await fetch(`/api/crm/cards/${card.id}`, { method: "DELETE" });
    onDelete(card.id);
    onClose();
  }

  const currentIdx = allStages.findIndex((s) => s.key === card.stage);
  const prevStage  = currentIdx > 0 ? allStages[currentIdx - 1] : null;
  const nextStage  = currentIdx < allStages.length - 1 ? allStages[currentIdx + 1] : null;
  // Allow moving to pós-venda when on FECHADO
  const isOnFechado = card.stage === "FECHADO" && card.tab === "NOVOS";

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div
        className="h-full w-full max-w-sm overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
          <h3 className="font-semibold text-gray-900 truncate">{cardDisplayName(card)}</h3>
          <button onClick={onClose} className="ml-2 rounded p-1 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-4">
          {/* Contact info */}
          <div className="space-y-2 text-sm">
            {(card.client?.email ?? card.leadEmail) && (
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                {card.client?.email ?? card.leadEmail}
              </div>
            )}
            {cardPhone(card) && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                {cardPhone(card)}
              </div>
            )}
            {card.leadSource && (
              <div className="flex items-center gap-2 text-gray-500">
                <User className="h-3.5 w-3.5 flex-shrink-0" />
                Origem: {card.leadSource}
              </div>
            )}
          </div>

          {/* Stage navigation */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Etapa atual</p>
            <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
              {allStages.find((s) => s.key === card.stage)?.label ?? card.stage}
            </p>
            <div className="flex gap-2">
              {prevStage && (
                <button
                  onClick={() => moveStage(prevStage.key)}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {prevStage.label}
                </button>
              )}
              {nextStage && !isOnFechado && (
                <button
                  onClick={() => moveStage(nextStage.key)}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {nextStage.label}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
              {isOnFechado && (
                <button
                  onClick={() => moveStage("FECHADO")}
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Mover para Pós-Venda →
                </button>
              )}
            </div>
          </div>

          {/* WhatsApp */}
          {zapiConfigured && cardPhone(card) && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <MessageCircle className="inline h-3.5 w-3.5 mr-1" />
                WhatsApp
              </p>
              <textarea
                value={waMsg}
                onChange={(e) => setWaMsg(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
              <button
                onClick={sendWhatsApp}
                disabled={waSending || !waMsg.trim()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-3 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
              >
                <MessageCircle className="h-4 w-4" />
                {waSending ? "Enviando..." : "Enviar via WhatsApp"}
              </button>
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <StickyNote className="inline h-3.5 w-3.5 mr-1" />
              Anotações
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Anotações sobre este lead..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar anotações"}
            </button>
          </div>

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Remover do CRM
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  cards,
  onCardClick,
}: {
  stage: { key: string; label: string; color: string; dot: string };
  cards: CrmCard[];
  onCardClick: (card: CrmCard) => void;
}) {
  return (
    <div className="flex min-w-[220px] flex-1 flex-col rounded-xl border bg-white shadow-sm">
      <div className={`flex items-center gap-2 rounded-t-xl border-b px-3 py-2.5 ${stage.color}`}>
        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${stage.dot}`} />
        <span className="text-sm font-semibold text-gray-800">{stage.label}</span>
        <span className="ml-auto rounded-full bg-white/60 px-1.5 py-0.5 text-xs font-semibold text-gray-600">
          {cards.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => onCardClick(card)}
            className="w-full rounded-lg border border-gray-100 bg-gray-50 p-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-white hover:shadow"
          >
            <p className="truncate text-sm font-medium text-gray-900">{cardDisplayName(card)}</p>
            {cardPhone(card) && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-500">
                <Phone className="h-3 w-3" />{cardPhone(card)}
              </p>
            )}
            {card.leadSource && (
              <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                {card.leadSource}
              </span>
            )}
            {card.notes && (
              <p className="mt-1 line-clamp-2 text-xs text-gray-400">{card.notes}</p>
            )}
          </button>
        ))}
        {cards.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400">Nenhum lead aqui</p>
        )}
      </div>
    </div>
  );
}

// ─── Main CRM component ───────────────────────────────────────────────────────

export function CrmClient({
  initialNovos,
  initialPosVenda,
  zapiConfigured,
  lojaSlug,
}: {
  initialNovos:    CrmCard[];
  initialPosVenda: CrmCard[];
  zapiConfigured:  boolean;
  lojaSlug:        string;
}) {
  const [activeTab,  setActiveTab]  = useState<"NOVOS" | "POS_VENDA">("NOVOS");
  const [novos,      setNovos]      = useState<CrmCard[]>(initialNovos);
  const [posVenda,   setPosVenda]   = useState<CrmCard[]>(initialPosVenda);
  const [selected,   setSelected]   = useState<CrmCard | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const cards     = activeTab === "NOVOS" ? novos : posVenda;
  const setCards  = activeTab === "NOVOS" ? setNovos : setPosVenda;
  const stages    = activeTab === "NOVOS" ? NOVOS_STAGES : POS_VENDA_STAGES;

  function handleAdd(card: CrmCard) {
    setNovos((prev) => [card, ...prev]);
  }

  function handleUpdate(updated: CrmCard) {
    // If tab changed (FECHADO → POS_VENDA), move between lists
    if (updated.tab === "POS_VENDA") {
      setNovos((prev) => prev.filter((c) => c.id !== updated.id));
      setPosVenda((prev) => {
        const exists = prev.find((c) => c.id === updated.id);
        return exists ? prev.map((c) => c.id === updated.id ? updated : c) : [updated, ...prev];
      });
      setSelected(updated);
      // Auto-switch tab to pós-venda
      setActiveTab("POS_VENDA");
    } else {
      setNovos((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      setPosVenda((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      setSelected(updated);
    }
  }

  function handleDelete(id: string) {
    setNovos((prev) => prev.filter((c) => c.id !== id));
    setPosVenda((prev) => prev.filter((c) => c.id !== id));
    setSelected(null);
  }

  const allStages = activeTab === "NOVOS"
    ? NOVOS_STAGES
    : POS_VENDA_STAGES;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
          <p className="text-sm text-gray-500">Pipeline de leads e pós-venda</p>
        </div>
        {activeTab === "NOVOS" && (
          <Button onClick={() => setShowNewForm(true)}>
            <Plus className="h-4 w-4" />
            Novo Lead
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border bg-gray-100 p-1 w-fit">
        <button
          onClick={() => setActiveTab("NOVOS")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "NOVOS"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Novos Clientes
          <span className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${activeTab === "NOVOS" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"}`}>
            {novos.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("POS_VENDA")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "POS_VENDA"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Pós-Venda
          <span className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${activeTab === "POS_VENDA" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
            {posVenda.length}
          </span>
        </button>
      </div>

      {/* Kanban */}
      <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.key}
            stage={stage}
            cards={cards.filter((c) => c.stage === stage.key)}
            onCardClick={(card) => {
              setSelected(card);
              // Ensure correct tab
              setActiveTab(card.tab === "NOVOS" ? "NOVOS" : "POS_VENDA");
            }}
          />
        ))}
      </div>

      {/* Side panel */}
      {selected && (
        <CardPanel
          card={selected}
          allStages={
            selected.tab === "NOVOS"
              ? NOVOS_STAGES
              : POS_VENDA_STAGES
          }
          zapiConfigured={zapiConfigured}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onClose={() => setSelected(null)}
        />
      )}

      {/* New lead form */}
      {showNewForm && (
        <NewCardForm
          onAdd={handleAdd}
          onClose={() => setShowNewForm(false)}
        />
      )}
    </div>
  );
}
