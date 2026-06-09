/**
 * Z-API wrapper — https://developer.z-api.io/
 *
 * Credenciais armazenadas por tenant (zapiInstanceId + zapiToken).
 */

export interface ZApiConfig {
  instanceId: string;
  token: string;
}

export interface SendTextResult {
  phone: string;
  success: boolean;
  error?: string;
  zapiMessageId?: string;
}

/** Formata número para o padrão Z-API: apenas dígitos, com código do país. */
export function formatPhone(raw: string): string {
  // Remove tudo que não é dígito
  let digits = raw.replace(/\D/g, "");

  // Se começar com 0, remove
  if (digits.startsWith("0")) digits = digits.slice(1);

  // Se não começar com 55 e tiver 10 ou 11 dígitos, adiciona 55
  if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
    digits = "55" + digits;
  }

  return digits;
}

/** Valida se o número formatado parece válido (DDI + DDD + número). */
export function isValidPhone(formatted: string): boolean {
  // Brasil: 55 + 2 dígitos DDD + 8 ou 9 dígitos = 12 ou 13 dígitos
  return /^55\d{10,11}$/.test(formatted);
}

/** URL base de uma instância Z-API. */
function baseUrl(cfg: ZApiConfig): string {
  return `https://api.z-api.io/instances/${cfg.instanceId}/token/${cfg.token}`;
}

/**
 * Testa se a instância Z-API está conectada.
 * Retorna { connected: true } ou lança um erro.
 */
export async function zapiTestConnection(cfg: ZApiConfig): Promise<{ connected: boolean; status?: string }> {
  const res = await fetch(`${baseUrl(cfg)}/status`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Z-API status ${res.status}: ${text}`);
  }

  const data = await res.json();
  // Z-API retorna { connected: true/false, ... }
  return { connected: !!data.connected, status: data.status };
}

/**
 * Envia uma mensagem de texto para um número via Z-API.
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

  try {
    const res = await fetch(`${baseUrl(cfg)}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: formatted, message }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        phone,
        success: false,
        error: data?.message ?? data?.error ?? `HTTP ${res.status}`,
      };
    }

    return {
      phone,
      success: true,
      zapiMessageId: data?.zaapId ?? data?.messageId ?? undefined,
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
