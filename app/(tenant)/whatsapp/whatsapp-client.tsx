"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  MessageCircle, Search, Send, CheckCircle2, XCircle,
  AlertTriangle, Users, Phone, ChevronDown, ChevronUp,
  Settings, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Client {
  id:           string;
  name:         string;
  nomeFantasia: string | null;
  phone:        string | null;
  active:       boolean;
}

interface SendResult {
  clientId: string;
  nome?:    string;
  phone:    string;
  success:  boolean;
  error?:   string;
}

// ─── Variáveis disponíveis ────────────────────────────────────────────────────

const VARIABLES = [
  { label: "{nome}",         desc: "Razão Social do cliente" },
  { label: "{nomeFantasia}", desc: "Nome Fantasia (usa Razão Social se não tiver)" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function displayName(c: Client) {
  return c.nomeFantasia ?? c.name;
}

function previewMessage(template: string, c: Client) {
  return template
    .replace(/\{nome\}/gi, c.name)
    .replace(/\{nomeFantasia\}/gi, c.nomeFantasia ?? c.name);
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function WhatsAppClient({
  zapiConfigured,
  clients,
}: {
  zapiConfigured: boolean;
  clients: Client[];
}) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState("");
  const [filterActive, setFilterActive] = useState<"todos" | "ativos" | "inativos">("ativos");
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [message,      setMessage]      = useState("");
  const [sending,      setSending]      = useState(false);
  const [results,      setResults]      = useState<SendResult[] | null>(null);
  const [showPreview,  setShowPreview]  = useState(false);
  const [showResults,  setShowResults]  = useState(false);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchSearch =
        !search ||
        displayName(c).toLowerCase().includes(search.toLowerCase()) ||
        (c.phone ?? "").includes(search);
      const matchActive =
        filterActive === "todos" ||
        (filterActive === "ativos"   && c.active) ||
        (filterActive === "inativos" && !c.active);
      return matchSearch && matchActive;
    });
  }, [clients, search, filterActive]);

  const withPhone    = filtered.filter((c) => c.phone);
  const withoutPhone = filtered.filter((c) => !c.phone);

  // ── Selection helpers ─────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(withPhone.map((c) => c.id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  const selectedClients = clients.filter((c) => selected.has(c.id) && c.phone);

  // ── Enviar disparos ───────────────────────────────────────────────────────
  async function handleSend() {
    if (!message.trim() || selectedClients.length === 0) return;
    setSending(true);
    setResults(null);
    setShowResults(false);

    try {
      const res = await fetch("/api/zapi/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          recipients: selectedClients.map((c) => ({
            clientId:     c.id,
            phone:        c.phone!,
            nome:         c.name,
            nomeFantasia: c.nomeFantasia,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error ?? "Erro ao enviar disparos.");
        return;
      }

      setResults(data.results);
      setShowResults(true);
    } finally {
      setSending(false);
    }
  }

  // ── Preview client ────────────────────────────────────────────────────────
  const previewClient = selectedClients[0] ?? clients[0];

  // ── Resultado ─────────────────────────────────────────────────────────────
  const successCount = results?.filter((r) => r.success).length ?? 0;
  const failedCount  = results?.filter((r) => !r.success).length  ?? 0;

  // ─────────────────────────────────────────────────────────────────────────

  if (!zapiConfigured) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <MessageCircle className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">WhatsApp não configurado</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-500">
          Para usar os disparos, configure o Instance ID e Token da Z-API nas integrações.
        </p>
        <Link href="/configuracoes#integracoes" className="mt-6">
          <Button className="gap-2">
            <Settings className="h-4 w-4" />
            Configurar Z-API
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <MessageCircle className="h-6 w-6 text-green-600" />
            Disparos WhatsApp
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Envie mensagens personalizadas para seus clientes via Z-API.
          </p>
        </div>
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          Z-API conectada
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">

        {/* ── Coluna esquerda: seleção de clientes ── */}
        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-gray-400" />
                  Destinatários
                </span>
                <span className="text-xs font-normal text-gray-400">
                  {selected.size} selecionado(s)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Filtro ativo/inativo */}
              <div className="flex rounded-lg border border-gray-200 p-0.5">
                {(["ativos", "todos", "inativos"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterActive(f)}
                    className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors capitalize ${
                      filterActive === f
                        ? "bg-blue-800 text-white"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Selecionar todos / limpar */}
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="flex-1 rounded-md border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Selecionar todos ({withPhone.length})
                </button>
                <button
                  onClick={clearAll}
                  className="flex-1 rounded-md border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Limpar
                </button>
              </div>

              {/* Lista de clientes */}
              <div className="max-h-[420px] overflow-y-auto space-y-1 pr-1">
                {withPhone.length === 0 && withoutPhone.length === 0 && (
                  <p className="py-6 text-center text-sm text-gray-400">
                    Nenhum cliente encontrado.
                  </p>
                )}

                {withPhone.map((c) => (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                      selected.has(c.id)
                        ? "border-green-300 bg-green-50"
                        : "border-gray-100 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="h-4 w-4 rounded accent-green-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {displayName(c)}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-gray-400">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </p>
                    </div>
                    {!c.active && (
                      <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">
                        inativo
                      </span>
                    )}
                  </label>
                ))}

                {withoutPhone.length > 0 && (
                  <div className="pt-2">
                    <p className="mb-1 flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      Sem telefone cadastrado ({withoutPhone.length})
                    </p>
                    {withoutPhone.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 rounded-lg border border-dashed border-gray-200 px-3 py-2 opacity-50"
                      >
                        <div className="h-4 w-4 rounded border border-gray-300" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-gray-500">{displayName(c)}</p>
                          <p className="text-xs text-gray-400">— sem telefone</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Coluna direita: mensagem + envio ── */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Mensagem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Variáveis disponíveis */}
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    title={v.desc}
                    onClick={() => setMessage((m) => m + v.label)}
                    className="rounded-md border border-dashed border-green-300 bg-green-50 px-2 py-1 text-xs font-mono text-green-700 hover:bg-green-100"
                  >
                    {v.label}
                  </button>
                ))}
                <span className="text-xs text-gray-400 self-center">
                  Clique para inserir na mensagem
                </span>
              </div>

              {/* Textarea */}
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Olá, {nomeFantasia}! Temos novidades para você..."
                rows={6}
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              />
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{message.length} caracteres</span>
                <span>~{Math.ceil(message.length / 160)} SMS equivalente</span>
              </div>

              {/* Preview */}
              {previewClient && message && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowPreview((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {showPreview ? "Ocultar preview" : "Ver preview"}
                    {showPreview ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showPreview && (
                    <div className="mt-2 rounded-xl bg-[#e5ddd5] p-3">
                      <p className="mb-1 text-[10px] text-gray-500">
                        Preview com: <strong>{displayName(previewClient)}</strong>
                      </p>
                      <div className="max-w-xs rounded-xl rounded-tl-none bg-white px-3 py-2 shadow-sm">
                        <p className="whitespace-pre-wrap text-sm text-gray-800">
                          {previewMessage(message, previewClient)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumo + Botão enviar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {selectedClients.length === 0
                      ? "Nenhum destinatário selecionado"
                      : `Enviar para ${selectedClients.length} cliente(s)`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {message.trim() ? `${message.length} caracteres` : "Mensagem vazia"}
                  </p>
                </div>
                <Button
                  onClick={handleSend}
                  disabled={sending || selectedClients.length === 0 || !message.trim()}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Send className="h-4 w-4" />
                  {sending ? "Enviando..." : "Disparar"}
                </Button>
              </div>

              {/* Barra de progresso durante envio */}
              {sending && (
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full animate-pulse rounded-full bg-green-500" style={{ width: "60%" }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Aguarde, enviando mensagens...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resultados */}
          {results && showResults && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>Resultado do disparo</span>
                  <button
                    onClick={() => setShowResults(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Fechar
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Resumo */}
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-semibold text-green-700">{successCount}</span>
                    <span className="text-gray-500">enviados</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="font-semibold text-red-600">{failedCount}</span>
                    <span className="text-gray-500">falhas</span>
                  </div>
                </div>

                {/* Detalhes */}
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {results.map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${
                        r.success
                          ? "bg-green-50 text-green-800"
                          : "bg-red-50 text-red-800"
                      }`}
                    >
                      {r.success
                        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                        : <XCircle    className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                      <span className="font-medium">{r.nome ?? r.phone}</span>
                      <span className="text-gray-400">{r.phone}</span>
                      {r.error && (
                        <span className="ml-auto text-red-500">{r.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
