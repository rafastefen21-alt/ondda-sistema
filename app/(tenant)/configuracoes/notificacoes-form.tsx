"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Mail, MessageCircle, CheckCircle, CalendarClock, Copy, Loader2 } from "lucide-react";
import {
  DEFAULT_NOTIFICACOES, mergeNotificacoes, LEMBRETE_TEMPLATE_CORPO, LEMBRETE_TEMPLATE_NOME,
  type TenantNotificacoes,
} from "@/lib/notificacoes";

interface LembreteResultado {
  cliente: string; telefone: string | null; diasAntes: number; vencimento: string;
  valor: number; enviado: boolean; modo: string; erro?: string;
}

// ─── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2">
      <div className="mt-0.5 flex-shrink-0">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            checked ? "bg-blue-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      <div>
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        {description && <span className="block text-xs text-gray-400">{description}</span>}
      </div>
    </label>
  );
}

// ─── Message row ───────────────────────────────────────────────────────────────

function MsgRow({
  label,
  enabled,
  onToggle,
  value,
  onChange,
  placeholder,
}: {
  label:       string;
  enabled:     boolean;
  onToggle:    (v: boolean) => void;
  value:       string;
  onChange:    (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2">
      <Toggle checked={enabled} onChange={onToggle} label={label} />
      {enabled && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
      )}
      {enabled && (
        <p className="text-xs text-gray-400">
          Variáveis disponíveis: <code className="bg-gray-200 px-1 rounded">{"{nome}"}</code>{" "}
          <code className="bg-gray-200 px-1 rounded">{"{pedido}"}</code>{" "}
          <code className="bg-gray-200 px-1 rounded">{"{valor}"}</code>
        </p>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  initial: unknown;
  zapiConfigured: boolean;
}

export function NotificacoesForm({ initial, zapiConfigured }: Props) {
  const router = useRouter();
  const [cfg, setCfg] = useState<TenantNotificacoes>(() => mergeNotificacoes(initial));
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function setEmail<K extends keyof TenantNotificacoes["email"]>(k: K, v: boolean) {
    setCfg((prev) => ({ ...prev, email: { ...prev.email, [k]: v } }));
  }

  function setWa<K extends keyof TenantNotificacoes["whatsapp"]>(k: K, v: boolean) {
    setCfg((prev) => ({ ...prev, whatsapp: { ...prev.whatsapp, [k]: v } }));
  }

  function setMsg<K extends keyof TenantNotificacoes["mensagens"]>(k: K, v: string) {
    setCfg((prev) => ({ ...prev, mensagens: { ...prev.mensagens, [k]: v } }));
  }

  function setLembrete<K extends keyof TenantNotificacoes["lembretes"]>(k: K, v: TenantNotificacoes["lembretes"][K]) {
    setCfg((prev) => ({ ...prev, lembretes: { ...prev.lembretes, [k]: v } }));
  }

  // Lembretes de vencimento — teste manual
  const [diasTexto, setDiasTexto] = useState(() => mergeNotificacoes(initial).lembretes.diasAntes.join(", "));
  const [lembLoading, setLembLoading] = useState<"simular" | "enviar" | null>(null);
  const [lembErro, setLembErro] = useState("");
  const [lembResultado, setLembResultado] = useState<{ hoje: string; resultados: LembreteResultado[] } | null>(null);
  const [copiado, setCopiado] = useState(false);

  function aplicarDias(texto: string) {
    setDiasTexto(texto);
    const dias = texto.split(/[\s,;]+/).map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n) && n >= 0);
    setLembrete("diasAntes", dias);
  }

  async function rodarLembretes(simular: boolean) {
    if (!simular && !confirm("Enviar agora os lembretes de hoje por WhatsApp aos clientes? (Salve a configuração antes.)")) return;
    setLembLoading(simular ? "simular" : "enviar");
    setLembErro("");
    setLembResultado(null);
    try {
      const res = await fetch("/api/cron/lembretes-boleto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simular }),
      });
      const data = await res.json();
      if (!res.ok) { setLembErro(data.error ?? "Falha ao processar lembretes."); return; }
      setLembResultado(data);
    } catch {
      setLembErro("Erro de conexão.");
    } finally {
      setLembLoading(null);
    }
  }

  async function copiarCorpo() {
    try {
      await navigator.clipboard.writeText(LEMBRETE_TEMPLATE_CORPO);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* ignora */ }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess(false);
    const res = await fetch("/api/configuracoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificacoes: cfg }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Erro ao salvar. Tente novamente.");
    } else {
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    }
  }

  function resetDefaults() {
    setCfg(DEFAULT_NOTIFICACOES);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-5 w-5 text-blue-600" />
          Mensagens Automáticas
        </CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Ative ou desative notificações automáticas por e-mail e WhatsApp para cada evento do pedido.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* ── E-mail ─────────────────────────────────────────────────────────── */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-800">E-mail</h3>
          </div>
          <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
            <div className="px-3">
              <Toggle
                checked={cfg.email.statusAtualizado}
                onChange={(v) => setEmail("statusAtualizado", v)}
                label="Atualização de status do pedido"
                description="Enviado ao cliente quando o pedido muda para: Aprovado, Em produção, Pronto, Em entrega, Entregue, Cancelado."
              />
            </div>
            <div className="px-3">
              <Toggle
                checked={cfg.email.cobrancaGerada}
                onChange={(v) => setEmail("cobrancaGerada", v)}
                label="Link de pagamento (cobrança)"
                description="Enviado automaticamente ao aprovar o pedido quando Mercado Pago está configurado."
              />
            </div>
            <div className="px-3">
              <Toggle
                checked={cfg.email.pagamentoConfirmado}
                onChange={(v) => setEmail("pagamentoConfirmado", v)}
                label="Confirmação de pagamento"
                description="Enviado após o pagamento ser confirmado pelo Mercado Pago."
              />
            </div>
            <div className="px-3">
              <Toggle
                checked={cfg.email.nfeEmitida}
                onChange={(v) => setEmail("nfeEmitida", v)}
                label="NF-e emitida"
                description="Enviado com o link da DANFE quando a Nota Fiscal é autorizada pela SEFAZ."
              />
            </div>
          </div>
        </div>

        {/* ── WhatsApp ────────────────────────────────────────────────────────── */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-green-500" />
            <h3 className="text-sm font-semibold text-gray-800">WhatsApp</h3>
            {!zapiConfigured && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                WhatsApp (Datafy) não configurado
              </span>
            )}
          </div>
          {!zapiConfigured && (
            <p className="mb-3 text-xs text-amber-600">
              Configure a integração com a Datafy na seção "Integrações" para habilitar envios automáticos via WhatsApp.
            </p>
          )}
          <div className="space-y-2">
            <MsgRow
              label="Pedido aprovado"
              enabled={cfg.whatsapp.statusAprovado}
              onToggle={(v) => setWa("statusAprovado", v)}
              value={cfg.mensagens.statusAprovado}
              onChange={(v) => setMsg("statusAprovado", v)}
              placeholder={DEFAULT_NOTIFICACOES.mensagens.statusAprovado}
            />
            <MsgRow
              label="Em produção"
              enabled={cfg.whatsapp.statusEmProducao}
              onToggle={(v) => setWa("statusEmProducao", v)}
              value={cfg.mensagens.statusEmProducao}
              onChange={(v) => setMsg("statusEmProducao", v)}
              placeholder={DEFAULT_NOTIFICACOES.mensagens.statusEmProducao}
            />
            <MsgRow
              label="Pronto para entrega"
              enabled={cfg.whatsapp.statusPronto}
              onToggle={(v) => setWa("statusPronto", v)}
              value={cfg.mensagens.statusPronto}
              onChange={(v) => setMsg("statusPronto", v)}
              placeholder={DEFAULT_NOTIFICACOES.mensagens.statusPronto}
            />
            <MsgRow
              label="Em rota de entrega"
              enabled={cfg.whatsapp.statusEmEntrega}
              onToggle={(v) => setWa("statusEmEntrega", v)}
              value={cfg.mensagens.statusEmEntrega}
              onChange={(v) => setMsg("statusEmEntrega", v)}
              placeholder={DEFAULT_NOTIFICACOES.mensagens.statusEmEntrega}
            />
            <MsgRow
              label="Pedido entregue"
              enabled={cfg.whatsapp.statusEntregue}
              onToggle={(v) => setWa("statusEntregue", v)}
              value={cfg.mensagens.statusEntregue}
              onChange={(v) => setMsg("statusEntregue", v)}
              placeholder={DEFAULT_NOTIFICACOES.mensagens.statusEntregue}
            />
            <MsgRow
              label="Pedido cancelado"
              enabled={cfg.whatsapp.statusCancelado}
              onToggle={(v) => setWa("statusCancelado", v)}
              value={cfg.mensagens.statusCancelado}
              onChange={(v) => setMsg("statusCancelado", v)}
              placeholder={DEFAULT_NOTIFICACOES.mensagens.statusCancelado}
            />
            <MsgRow
              label="Link de pagamento gerado"
              enabled={cfg.whatsapp.cobrancaGerada}
              onToggle={(v) => setWa("cobrancaGerada", v)}
              value={cfg.mensagens.cobrancaGerada}
              onChange={(v) => setMsg("cobrancaGerada", v)}
              placeholder={DEFAULT_NOTIFICACOES.mensagens.cobrancaGerada}
            />
            <MsgRow
              label="Pagamento confirmado"
              enabled={cfg.whatsapp.pagamentoConfirmado}
              onToggle={(v) => setWa("pagamentoConfirmado", v)}
              value={cfg.mensagens.pagamentoConfirmado}
              onChange={(v) => setMsg("pagamentoConfirmado", v)}
              placeholder={DEFAULT_NOTIFICACOES.mensagens.pagamentoConfirmado}
            />
          </div>
        </div>

        {/* ── Lembretes de vencimento de boleto ──────────────────────────────── */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-800">Lembrete de vencimento do boleto (WhatsApp)</h3>
          </div>
          <div className="space-y-3 rounded-xl border border-gray-100 p-3">
            <Toggle
              checked={cfg.lembretes.ativo}
              onChange={(v) => setLembrete("ativo", v)}
              label="Enviar lembretes automáticos"
              description="Todo dia às 9h o sistema avisa, por WhatsApp, os clientes cujos boletos vencem nos dias configurados abaixo. Cada lembrete é enviado uma única vez por boleto."
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-xs text-gray-600">
                Dias antes do vencimento
                <input
                  value={diasTexto}
                  onChange={(e) => aplicarDias(e.target.value)}
                  placeholder="7, 2"
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </label>
              <label className="space-y-1 text-xs text-gray-600">
                Nome do modelo aprovado (Meta)
                <input
                  value={cfg.lembretes.templateNome}
                  onChange={(e) => setLembrete("templateNome", e.target.value.trim())}
                  placeholder={LEMBRETE_TEMPLATE_NOME}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </label>
              <label className="space-y-1 text-xs text-gray-600">
                Idioma do modelo
                <input
                  value={cfg.lembretes.templateIdioma}
                  onChange={(e) => setLembrete("templateIdioma", e.target.value.trim())}
                  placeholder="pt_BR"
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </label>
            </div>

            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-medium">Por que precisa de um modelo aprovado?</p>
              <p className="mt-1">
                O WhatsApp só entrega mensagens iniciadas pela empresa fora da janela de 24h se forem um
                <strong> modelo aprovado pela Meta</strong>. Cadastre o modelo abaixo no painel da Datafy
                (ou no Gerenciador do WhatsApp da Meta) com o nome <code className="rounded bg-amber-100 px-1">{LEMBRETE_TEMPLATE_NOME}</code>,
                categoria <strong>Utilidade</strong>, idioma <strong>Português (BR)</strong>, e com 6 variáveis no corpo.
                Depois de aprovado, ative o envio acima.
              </p>
              <pre className="mt-2 whitespace-pre-wrap rounded-md border border-amber-200 bg-white p-2 font-sans text-xs text-gray-800">{LEMBRETE_TEMPLATE_CORPO}</pre>
              <p className="mt-1 text-amber-700">
                Variáveis: {"{{1}}"} nome do cliente · {"{{2}}"} distribuidora · {"{{3}}"} nº do pedido ·
                {" {{4}}"} valor · {"{{5}}"} vencimento · {"{{6}}"} linha digitável.
                Exemplos para a aprovação: Padaria São José · Casa do Pão SP · A1B2C3D4 · R$ 528,00 · 28/10/2026 · 34191.09008 00000.123456 78901.234567 8 12340000052800
              </p>
              <button
                type="button"
                onClick={copiarCorpo}
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                <Copy className="h-3 w-3" />
                {copiado ? "Copiado!" : "Copiar texto do modelo"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" disabled={!!lembLoading} onClick={() => rodarLembretes(true)}>
                {lembLoading === "simular" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Conferindo...</> : "Ver quem receberia hoje"}
              </Button>
              <Button type="button" variant="outline" disabled={!!lembLoading || !zapiConfigured} onClick={() => rodarLembretes(false)}>
                {lembLoading === "enviar" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : "Enviar lembretes de hoje agora"}
              </Button>
            </div>
            {lembErro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{lembErro}</p>}
            {lembResultado && (
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Cliente</th>
                      <th className="px-2 py-1.5 font-medium">Telefone</th>
                      <th className="px-2 py-1.5 font-medium">Vence</th>
                      <th className="px-2 py-1.5 font-medium">Valor</th>
                      <th className="px-2 py-1.5 font-medium">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lembResultado.resultados.length === 0 && (
                      <tr><td colSpan={5} className="px-2 py-2 text-gray-500">Nenhum boleto vence nos dias configurados (referência: {lembResultado.hoje}).</td></tr>
                    )}
                    {lembResultado.resultados.map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-1.5">{r.cliente}</td>
                        <td className="px-2 py-1.5 font-mono">{r.telefone ?? "—"}</td>
                        <td className="px-2 py-1.5">{r.vencimento.split("-").reverse().join("/")} ({r.diasAntes}d)</td>
                        <td className="px-2 py-1.5">R$ {r.valor.toFixed(2)}</td>
                        <td className={`px-2 py-1.5 ${r.enviado ? "text-green-700" : r.modo === "simulacao" ? "text-gray-700" : "text-amber-700"}`}>
                          {r.enviado ? `Enviado (${r.modo})` : r.modo === "simulacao" ? "Receberia" : r.erro ?? "Não enviado"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Actions ─────────────────────────────────────────────────────────── */}
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar configurações"}
          </Button>
          <button
            type="button"
            onClick={resetDefaults}
            className="text-sm text-gray-400 underline hover:text-gray-600"
          >
            Restaurar padrões
          </button>
          {success && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Salvo com sucesso!
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
