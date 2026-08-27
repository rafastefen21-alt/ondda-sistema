"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, X, ChevronRight, ChevronLeft, Trash2,
  Phone, Mail, MessageCircle, StickyNote, Send, Loader2,
  FileText, Download, ShoppingCart, Link2, Search, ChevronDown, ExternalLink, Landmark,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrmCardClient {
  id: string;
  name: string | null;
  nomeFantasia: string | null;
  email: string;
  phone: string | null;
}

interface WaConversationSummary {
  unreadCount: number;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastDirection: string | null;
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
  waConversation?: WaConversationSummary | null;
}

interface WaMessageItem {
  id?: string;
  direction: string;
  body: string;
  status?: string | null;
  authorName?: string | null;
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

function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

// ─── WhatsApp conversation (inbox) ─────────────────────────────────────────────

function Conversation({ card, stageTemplate }: { card: CrmCard; stageTemplate: string }) {
  const [messages, setMessages] = useState<WaMessageItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [text, setText]         = useState("");
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }

  useEffect(() => {
    let active = true;

    function load(initial: boolean) {
      if (initial) setLoading(true);
      fetch(`/api/crm/cards/${card.id}/messages`)
        .then((r) => r.json())
        .then((data) => {
          if (!active) return;
          const list: WaMessageItem[] = Array.isArray(data.messages) ? data.messages : [];
          setMessages((prev) => {
            // Só rola/atualiza se mudou o número de mensagens (evita mexer enquanto digita)
            if (prev.length !== list.length) scrollToBottom();
            return list;
          });
        })
        .catch(() => {})
        .finally(() => { if (active && initial) setLoading(false); });
    }

    load(true);
    const timer = setInterval(() => load(false), 15000);
    return () => { active = false; clearInterval(timer); };
  }, [card.id]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/crm/cards/${card.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: body }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setMessages((prev) => [...prev, data.message]);
        setText("");
        scrollToBottom();
      } else {
        setError(data.error ?? "Falha ao enviar.");
      }
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Thread */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] p-4"
      >
        {loading ? (
          <p className="py-10 text-center text-xs text-gray-500">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </p>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageCircle className="mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">Nenhuma mensagem ainda.</p>
            <p className="text-xs text-gray-400">Envie a primeira ou aguarde o cliente escrever.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const out = m.direction === "OUT";
            return (
              <div key={m.id ?? i} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    out
                      ? "rounded-br-sm bg-[#d9fdd3] text-gray-800"
                      : "rounded-bl-sm border border-gray-200 bg-white text-gray-800"
                  }`}
                >
                  {out && m.authorName && (
                    <p className="mb-0.5 text-[10px] font-semibold text-green-700">{m.authorName}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-1 text-right text-[10px] text-gray-400">
                    {formatMsgTime(m.createdAt)}
                    {out && m.status ? ` · ${m.status}` : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="border-t bg-white p-3">
        {stageTemplate && (
          <button
            type="button"
            onClick={() => setText(stageTemplate)}
            className="mb-1.5 text-xs text-blue-600 hover:underline"
          >
            Inserir modelo da etapa
          </button>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            rows={2}
            placeholder="Escreva uma mensagem... (Enter envia, Shift+Enter quebra linha)"
            className="flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
            title="Enviar"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}

// ─── Lead history (pedidos / NFs / boletos) ───────────────────────────────────

interface SummaryClient {
  id: string; name: string | null; nomeFantasia: string | null; email: string;
  phone: string | null; cnpj: string | null; cpf: string | null;
  city: string | null; state: string | null; prazoBoletoDias: number | null;
}
interface SummaryInvoice {
  id: string; number: string | null; status: string;
  pdfUrl: string | null; focusNfeRef: string | null; issuedAt: string | null;
}
interface SummaryPayment {
  id: string; amount: number; method: string; status: string;
  dueDate: string; paidAt: string | null;
  linhaDigitavel: string | null; boletoPdfUrl: string | null; itauNossoNumero: string | null;
}
interface SummaryOrder {
  id: string; status: string; paymentMethod: string | null; createdAt: string;
  scheduledDeliveryDate: string | null; total: number;
  items: { name: string; unit: string | null; quantity: number; unitPrice: number }[];
  invoices: SummaryInvoice[];
  payments: SummaryPayment[];
}
interface ClientResult {
  id: string; name: string | null; nomeFantasia: string | null;
  email: string; phone: string | null; cnpj: string | null;
}

function prettyStatus(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
}
function statusClass(s: string) {
  const up = s.toUpperCase();
  if (/PAGO|EMITID|ENTREGUE|APROVAD/.test(up)) return "bg-green-100 text-green-700";
  if (/CANCEL|ERRO|VENCID/.test(up)) return "bg-red-100 text-red-600";
  return "bg-amber-100 text-amber-700";
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function ClientLinker({ card, onLinked }: { card: CrmCard; onLinked: (updated: CrmCard) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/crm/client-search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((d) => setResults(Array.isArray(d.clients) ? d.clients : []))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function link(clientId: string) {
    setLinking(true);
    const res = await fetch(`/api/crm/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    if (res.ok) onLinked(await res.json());
    setLinking(false);
  }

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3">
      <p className="mb-1 text-sm font-medium text-gray-700">Vincular a um cliente</p>
      <p className="mb-2 text-xs text-gray-400">
        Ligue este lead a um cliente cadastrado para ver pedidos, NFs e boletos.
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, CNPJ, telefone..."
          className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {searching && <p className="mt-2 text-xs text-gray-400">Buscando...</p>}
      {results.length > 0 && (
        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => link(c.id)}
              disabled={linking}
              className="flex w-full items-center gap-2 rounded-md border border-gray-100 px-2 py-1.5 text-left text-xs hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50"
            >
              <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-gray-800">
                  {c.nomeFantasia ?? c.name ?? c.email}
                </span>
                {(c.cnpj || c.phone) && (
                  <span className="block truncate text-gray-400">{c.cnpj ?? c.phone}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LeadHistory({ card, onLinked }: { card: CrmCard; onLinked: (updated: CrmCard) => void }) {
  const [summary, setSummary] = useState<{ client: SummaryClient | null; orders: SummaryOrder[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/crm/cards/${card.id}/summary`)
      .then((r) => r.json())
      .then((d) => { if (active) setSummary(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [card.id, card.clientId]);

  if (loading) {
    return (
      <div className="py-4 text-center">
        <Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!summary?.client) {
    return <ClientLinker card={card} onLinked={onLinked} />;
  }

  const c = summary.client;
  const orders = summary.orders;

  async function unlink() {
    if (!confirm("Desvincular este cliente do lead?")) return;
    const res = await fetch(`/api/crm/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: null }),
    });
    if (res.ok) onLinked(await res.json());
  }

  return (
    <div className="space-y-3">
      {/* Cliente vinculado */}
      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">
              {c.nomeFantasia ?? c.name ?? c.email}
            </p>
            {c.cnpj && <p className="text-xs text-gray-500">CNPJ: {c.cnpj}</p>}
            {(c.city || c.state) && (
              <p className="text-xs text-gray-500">{[c.city, c.state].filter(Boolean).join(" / ")}</p>
            )}
            {c.prazoBoletoDias != null && (
              <p className="text-xs text-gray-500">Prazo boleto: {c.prazoBoletoDias} dias</p>
            )}
          </div>
          <button onClick={unlink} title="Desvincular cliente" className="text-xs text-gray-400 hover:text-red-500">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Pedidos */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
          <ShoppingCart className="h-3.5 w-3.5" />
          Pedidos ({orders.length})
        </p>
        {orders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-center text-xs text-gray-400">
            Nenhum pedido deste cliente.
          </p>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => {
              const open = expanded === o.id;
              return (
                <div key={o.id} className="overflow-hidden rounded-lg border border-gray-200">
                  <button
                    onClick={() => setExpanded(open ? null : o.id)}
                    className="flex w-full items-center justify-between gap-2 bg-white px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800">
                        #{o.id.slice(-6).toUpperCase()} · {fmtDate(o.createdAt)}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusClass(o.status)}`}>
                          {prettyStatus(o.status)}
                        </span>
                        {o.invoices.length > 0 && (
                          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                            {o.invoices.length} NF
                          </span>
                        )}
                        {o.payments.length > 0 && (
                          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                            {o.payments.length} boleto{o.payments.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <span className="text-xs font-semibold text-gray-900">{formatCurrency(o.total)}</span>
                      <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition ${open ? "rotate-180" : ""}`} />
                    </div>
                  </button>

                  {open && (
                    <div className="space-y-3 border-t bg-gray-50 px-3 py-2.5">
                      {/* Itens */}
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase text-gray-400">Itens</p>
                        <ul className="space-y-0.5">
                          {o.items.map((it, idx) => (
                            <li key={idx} className="flex justify-between gap-2 text-xs text-gray-600">
                              <span className="min-w-0 truncate">
                                {it.quantity}× {it.name}
                              </span>
                              <span className="flex-shrink-0 text-gray-500">
                                {formatCurrency(it.quantity * it.unitPrice)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* NFs */}
                      {o.invoices.length > 0 && (
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase text-gray-400">Notas fiscais</p>
                          <div className="space-y-1">
                            {o.invoices.map((inv) => (
                              <div key={inv.id} className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-xs">
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <FileText className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                                  <span className="truncate">NF {inv.number ?? "—"}</span>
                                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${statusClass(inv.status)}`}>
                                    {prettyStatus(inv.status)}
                                  </span>
                                </span>
                                {(inv.pdfUrl || inv.focusNfeRef) && (
                                  <a
                                    href={inv.pdfUrl ?? `/api/nfe/${inv.id}/danfe`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Baixar DANFE"
                                    className="flex-shrink-0 text-gray-400 hover:text-gray-700"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Boletos */}
                      {o.payments.length > 0 && (
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase text-gray-400">Boletos / pagamentos</p>
                          <div className="space-y-1">
                            {o.payments.map((p) => (
                              <div key={p.id} className="rounded-md bg-white px-2 py-1.5 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="flex min-w-0 items-center gap-1.5">
                                    <Landmark className="h-3.5 w-3.5 flex-shrink-0 text-orange-500" />
                                    <span className="truncate">{formatCurrency(p.amount)}</span>
                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${statusClass(p.status)}`}>
                                      {prettyStatus(p.status)}
                                    </span>
                                  </span>
                                  {p.boletoPdfUrl || p.linhaDigitavel ? (
                                    <a
                                      href={`/api/pagamentos/${p.id}/boleto`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Baixar boleto"
                                      className="flex-shrink-0 text-gray-400 hover:text-gray-700"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </a>
                                  ) : null}
                                </div>
                                <p className="mt-0.5 text-[10px] text-gray-400">
                                  Vencimento {fmtDate(p.dueDate)}
                                  {p.paidAt ? ` · pago ${fmtDate(p.paidAt)}` : ""}
                                </p>
                                {p.linhaDigitavel && (
                                  <p className="mt-0.5 break-all font-mono text-[10px] text-gray-500">
                                    {p.linhaDigitavel}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Link
                        href={`/pedidos/${o.id}`}
                        className="flex items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir pedido completo
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
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

  const stageTemplate =
    STAGE_WA_MESSAGES[card.stage]?.replace("{nome}", cardDisplayName(card)) ?? "";

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

  const phone = cardPhone(card);
  const email = card.client?.email ?? card.leadEmail;

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[92vh] sm:flex-row sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Coluna esquerda: dados do lead ── */}
        <aside className="flex max-h-[38vh] w-full flex-shrink-0 flex-col overflow-y-auto border-b bg-gray-50 sm:max-h-none sm:w-80 sm:border-b-0 sm:border-r">
          <div className="flex items-start justify-between gap-2 border-b bg-white px-4 py-3">
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-gray-900">{cardDisplayName(card)}</h3>
              {card.leadSource && (
                <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                  {card.leadSource}
                </span>
              )}
            </div>
            <button onClick={onClose} className="rounded p-1 hover:bg-gray-100 sm:hidden">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-5 p-4">
            {/* Contato */}
            <div className="space-y-2 text-sm">
              {email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                  {phone}
                </div>
              )}
            </div>

            {/* Etapa */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Etapa atual</p>
              <select
                value={card.stage}
                onChange={(e) => moveStage(e.target.value)}
                disabled={saving}
                className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
              >
                <optgroup label="Novos clientes">
                  {NOVOS_STAGES.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Pós-venda">
                  {POS_VENDA_STAGES.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </optgroup>
              </select>
              <div className="flex gap-2">
                {prevStage && (
                  <button
                    onClick={() => moveStage(prevStage.key)}
                    disabled={saving}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-2 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    {prevStage.label}
                  </button>
                )}
                {nextStage && !isOnFechado && (
                  <button
                    onClick={() => moveStage(nextStage.key)}
                    disabled={saving}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {nextStage.label}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
                {isOnFechado && (
                  <button
                    onClick={() => moveStage("FECHADO")}
                    disabled={saving}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-2 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Mover para Pós-Venda →
                  </button>
                )}
              </div>
            </div>

            {/* Cliente, pedidos, NFs e boletos */}
            <LeadHistory card={card} onLinked={onUpdate} />

            {/* Anotações */}
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

            {/* Remover */}
            <button
              onClick={handleDelete}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Remover do CRM
            </button>
          </div>
        </aside>

        {/* ── Coluna direita: conversa ── */}
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{cardDisplayName(card)}</p>
                {phone && <p className="truncate text-xs text-gray-500">{phone}</p>}
              </div>
            </div>
            <button onClick={onClose} className="hidden rounded p-1 hover:bg-gray-100 sm:block">
              <X className="h-5 w-5" />
            </button>
          </div>

          {zapiConfigured && phone ? (
            <Conversation card={card} stageTemplate={stageTemplate} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <MessageCircle className="mb-2 h-10 w-10 text-gray-300" />
              {!zapiConfigured ? (
                <p className="max-w-xs text-sm text-gray-500">
                  Conecte o WhatsApp (Datafy) em Configurações → Integrações para conversar por aqui.
                </p>
              ) : (
                <p className="max-w-xs text-sm text-gray-500">
                  Este card não tem número de WhatsApp. Adicione um telefone ao lead para conversar.
                </p>
              )}
            </div>
          )}
        </section>
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
            <div className="flex items-center gap-2">
              <p className="flex-1 truncate text-sm font-medium text-gray-900">{cardDisplayName(card)}</p>
              {!!card.waConversation?.unreadCount && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white">
                  {card.waConversation.unreadCount}
                </span>
              )}
            </div>
            {cardPhone(card) && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-gray-500">
                <Phone className="h-3 w-3" />{cardPhone(card)}
              </p>
            )}
            {card.waConversation?.lastMessageText && (
              <p className="mt-1 flex items-center gap-1 truncate text-xs text-gray-500">
                <MessageCircle className="h-3 w-3 flex-shrink-0 text-green-500" />
                <span className="truncate">
                  {card.waConversation.lastDirection === "OUT" ? "Você: " : ""}
                  {card.waConversation.lastMessageText}
                </span>
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
    const estavaPos = posVenda.some((c) => c.id === updated.id);
    const agoraPos  = updated.tab === "POS_VENDA";

    if (estavaPos !== agoraPos) {
      // Mudou de aba (nos dois sentidos) → move entre as listas e troca a aba
      if (agoraPos) {
        setNovos((prev) => prev.filter((c) => c.id !== updated.id));
        setPosVenda((prev) => [updated, ...prev.filter((c) => c.id !== updated.id)]);
        setActiveTab("POS_VENDA");
      } else {
        setPosVenda((prev) => prev.filter((c) => c.id !== updated.id));
        setNovos((prev) => [updated, ...prev.filter((c) => c.id !== updated.id)]);
        setActiveTab("NOVOS");
      }
    } else {
      // Mesma aba → só atualiza no lugar
      setNovos((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      setPosVenda((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    }
    setSelected(updated);
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
