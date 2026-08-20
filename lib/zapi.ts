/**
 * WhatsApp via Datafy API — https://app.datafyapi.com.br/docs
 *
 * A Datafy é um "drop-in" da API oficial do WhatsApp (Meta Cloud API):
 *   base  https://cloud.datafyapi.com.br/v1/
 *   auth  Authorization: Bearer sk_live_xxx   (sempre no header)
 *
 * As funções/nomes são mantidos (zapiSendText, etc.) para não quebrar os
 * pontos que já disparam WhatsApp. A config reaproveita os campos do tenant:
 *   instanceId → Phone Number ID (ID do número no painel Datafy)
 *   token      → token da Datafy (sk_live_...)
 */

const DATAFY_BASE = "https://cloud.datafyapi.com.br/v1";

export interface ZApiConfig {
  /** Phone Number ID do número no painel Datafy. */
  instanceId: string;
  /** Token da Datafy (sk_live_...). */
  token: string;
}

export interface SendTextResult {
  phone: string;
  success: boolean;
  error?: string;
  zapiMessageId?: string;
}

/** Formata número para o padrão do WhatsApp: apenas dígitos, com DDI do país. */
export function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = "55" + digits;
  }
  return digits;
}

/** Valida se o número formatado parece válido (DDI + DDD + número). */
export function isValidPhone(formatted: string): boolean {
  return /^55\d{10,11}$/.test(formatted);
}

function authHeaders(cfg: ZApiConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.token}`,
  };
}

/**
 * Testa se o número Datafy está acessível (consulta os dados do número).
 * Retorna { connected: true } se a API responder OK.
 */
export async function zapiTestConnection(cfg: ZApiConfig): Promise<{ connected: boolean; status?: string }> {
  if (!cfg.instanceId || !cfg.token) {
    throw new Error("Configure o Phone Number ID e o Token da Datafy.");
  }
  const res = await fetch(`${DATAFY_BASE}/${encodeURIComponent(cfg.instanceId)}`, {
    method: "GET",
    headers: authHeaders(cfg),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Datafy status ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json().catch(() => ({}));
  // Na Cloud API não há "connected" — se respondeu OK com os dados do número, está ativo.
  const numero = data?.display_phone_number ?? data?.verified_name ?? undefined;
  return { connected: true, status: numero };
}

/**
 * Envia uma mensagem de texto para um número via Datafy (Meta Cloud API).
 */
export async function zapiSendText(
  cfg: ZApiConfig,
  phone: string,
  message: string,
): Promise<SendTextResult> {
  const formatted = formatPhone(phone);

  if (!isValidPhone(formatted)) {
    return { phone, success: false, error: "Número de telefone inválido" };
  }
  if (!cfg.instanceId || !cfg.token) {
    return { phone, success: false, error: "WhatsApp (Datafy) não configurado" };
  }

  try {
    const res = await fetch(`${DATAFY_BASE}/${encodeURIComponent(cfg.instanceId)}/messages`, {
      method: "POST",
      headers: authHeaders(cfg),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formatted,
        type: "text",
        text: { preview_url: false, body: message },
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Meta Cloud API retorna { error: { message, ... } }
      const msg = data?.error?.message ?? data?.message ?? `HTTP ${res.status}`;
      return { phone, success: false, error: msg };
    }

    return {
      phone,
      success: true,
      zapiMessageId: data?.messages?.[0]?.id ?? undefined,
    };
  } catch (err: unknown) {
    return {
      phone,
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

/** Substitui variáveis na mensagem: {nome}, {nomeFantasia}. */
export function renderMessage(
  template: string,
  vars: { nome?: string; nomeFantasia?: string },
): string {
  return template
    .replace(/\{nome\}/gi, vars.nome ?? "")
    .replace(/\{nomeFantasia\}/gi, vars.nomeFantasia ?? vars.nome ?? "");
}
