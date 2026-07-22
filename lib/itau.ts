/**
 * lib/itau.ts — Integração com a API de Cobrança do Itaú (boleto registrado)
 *
 * Carteira 109. Autenticação com o Itaú = mTLS (certificado + chave) + OAuth2.
 *
 * Este arquivo cobre, por enquanto, o lado do WEBHOOK — ou seja, o caminho em
 * que o ITAÚ nos chama para avisar da baixa do boleto:
 *
 *   1. Itaú chama POST /api/webhooks/itau/autorizacao  (OAuth2 client_credentials)
 *      → devolvemos um access_token assinado por nós.
 *   2. Itaú chama POST /api/webhooks/itau com esse token no Bearer
 *      → damos baixa no pagamento.
 *
 * A emissão do boleto (nós chamando o Itaú) entra aqui quando tivermos o
 * contrato da API "Boletos - Emissão e Instrução" (OpenAPI do DevPortal).
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// ─── Endpoints do Itaú ────────────────────────────────────────────────────────
export const ITAU_URLS = {
  // Registro/consulta do webhook de cobrança
  notificacoes: "https://boletos.cloud.itau.com.br/boletos/v3/notificacoes_boletos",
  // Consulta de boletos
  consulta: "https://secure.api.cloud.itau.com.br/boletoscash/v2/boletos",
} as const;

export const ITAU_CARTEIRA = "109";

/** Validade do access_token que entregamos ao Itaú (segundos). */
const TOKEN_TTL = 3600;

function segredo(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET não configurado");
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

/**
 * id_beneficiario do Itaú = Agência(4) + "00" + Conta(5) + DAC(1).
 * Ex.: agência 1500, conta 01547, DAC 1 → 150000154711
 */
export function montarIdBeneficiario(
  agencia: string | null,
  conta: string | null,
  dac: string | null,
): string | null {
  if (!agencia || !conta || !dac) return null;
  return `${agencia.padStart(4, "0")}00${conta.padStart(5, "0")}${dac}`;
}

/**
 * Nosso Número da carteira 109 é responsabilidade do emissor: precisa ser
 * crescente e nunca repetir. Formata o sequencial em 8 dígitos.
 */
export function formatarNossoNumero(seq: number): string {
  return String(seq).padStart(8, "0");
}

// ─── Token que ENTREGAMOS ao Itaú (ele usa para chamar nosso webhook) ─────────

/** Gera um par de credenciais para cadastrar no Itaú (webhook_client_id/secret). */
export function gerarCredenciaisWebhook(): { clientId: string; clientSecret: string } {
  return {
    clientId:     randomBytes(16).toString("hex"),
    clientSecret: randomBytes(32).toString("hex"),
  };
}

/** Assina um access_token (HMAC) contendo o tenant e a expiração. */
export function assinarTokenWebhook(tenantId: string): { token: string; expiresIn: number } {
  const payload = JSON.stringify({
    t: tenantId,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL,
  });
  const corpo = b64url(payload);
  const assinatura = b64url(createHmac("sha256", segredo()).update(corpo).digest());
  return { token: `${corpo}.${assinatura}`, expiresIn: TOKEN_TTL };
}

/** Verifica o access_token devolvido pelo Itaú no header Authorization. */
export function verificarTokenWebhook(token: string): { tenantId: string } | null {
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [corpo, assinatura] = partes;

  const esperada = b64url(createHmac("sha256", segredo()).update(corpo).digest());
  if (!comparaSegura(assinatura, esperada)) return null;

  try {
    const { t, exp } = JSON.parse(Buffer.from(corpo, "base64url").toString());
    if (!t || typeof exp !== "number" || exp < Math.floor(Date.now() / 1000)) return null;
    return { tenantId: t as string };
  } catch {
    return null;
  }
}

/** Comparação em tempo constante (evita timing attack em segredos). */
export function comparaSegura(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
