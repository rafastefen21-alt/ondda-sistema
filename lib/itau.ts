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
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { prisma } from "@/lib/prisma";

// ─── Endpoints do Itaú ────────────────────────────────────────────────────────
export const ITAU_URLS = {
  /** OAuth2 client_credentials (exige mTLS com o certificado emitido pelo Itaú). */
  token: "https://sts.itau.com.br/api/oauth/token",
  /** Emissão/instrução de boletos — API "Boletos - Emissão e Instrução" v2. */
  boletos: "https://api.itau.com.br/cash_management/v2/boletos",
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

/**
 * Reserva o próximo Nosso Número do tenant de forma atômica (increment no
 * banco), garantindo que dois boletos simultâneos nunca recebam o mesmo.
 */
export async function proximoNossoNumero(tenantId: string): Promise<string> {
  const t = await prisma.tenant.update({
    where: { id: tenantId },
    data:  { itauNossoNumeroSeq: { increment: 1 } },
    select: { itauNossoNumeroSeq: true },
  });
  return formatarNossoNumero(t.itauNossoNumeroSeq);
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

// ─── Chamadas ao Itaú (mTLS) ─────────────────────────────────────────────────

/** Credenciais e dados de conta necessários para falar com o Itaú. */
export interface CredenciaisItau {
  clientId:     string;
  clientSecret: string;
  certificado:  string;  // PEM do .crt
  chavePrivada: string;  // PEM do .key
  agencia:      string;
  conta:        string;
  contaDac:     string;
  ambiente:     string;  // "Validacao" | "Efetivacao"
}

interface RespostaHttp {
  status: number;
  data: unknown;
}

/**
 * Requisição HTTPS com mTLS (certificado + chave do Itaú).
 * Usa node:https porque o fetch global não aceita certificado de cliente.
 */
function requisicaoMtls(
  url: string,
  opcoes: { method: string; headers: Record<string, string>; body?: string },
  cert: string,
  key: string,
): Promise<RespostaHttp> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = httpsRequest(
      {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: opcoes.method,
        headers: opcoes.headers,
        cert,
        key,
      },
      (res) => {
        let bruto = "";
        res.on("data", (c) => (bruto += c));
        res.on("end", () => {
          let data: unknown = bruto;
          try { data = JSON.parse(bruto); } catch { /* mantém texto */ }
          resolve({ status: res.statusCode ?? 0, data });
        });
      },
    );
    req.on("error", reject);
    if (opcoes.body) req.write(opcoes.body);
    req.end();
  });
}

/** Cache simples de access_token por tenant (evita pedir token a cada boleto). */
const cacheToken = new Map<string, { token: string; expiraEm: number }>();

/** Obtém o access_token do Itaú (OAuth2 client_credentials sobre mTLS). */
export async function obterAccessToken(
  tenantId: string,
  c: CredenciaisItau,
): Promise<string> {
  const emCache = cacheToken.get(tenantId);
  if (emCache && emCache.expiraEm > Date.now() + 30_000) return emCache.token;

  const corpo = new URLSearchParams({
    grant_type:    "client_credentials",
    client_id:     c.clientId,
    client_secret: c.clientSecret,
  }).toString();

  const { status, data } = await requisicaoMtls(
    ITAU_URLS.token,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(corpo).toString(),
      },
      body: corpo,
    },
    c.certificado,
    c.chavePrivada,
  );

  const d = data as { access_token?: string; expires_in?: number };
  if (status >= 400 || !d?.access_token) {
    throw new Error(`Falha ao obter token do Itaú (HTTP ${status}): ${JSON.stringify(data).slice(0, 300)}`);
  }

  cacheToken.set(tenantId, {
    token: d.access_token,
    expiraEm: Date.now() + (d.expires_in ?? 300) * 1000,
  });
  return d.access_token;
}

// ─── Emissão do boleto ───────────────────────────────────────────────────────

export interface PagadorBoleto {
  nome:        string;
  cnpj?:       string | null;
  cpf?:        string | null;
  logradouro?: string | null;
  numero?:     string | null;
  complemento?: string | null;
  bairro?:     string | null;
  cidade?:     string | null;
  uf?:         string | null;
  cep?:        string | null;
  email?:      string | null;
}

export interface ResultadoBoleto {
  nossoNumero:    string;
  linhaDigitavel: string | null;
  codigoBarras:   string | null;
  idBoleto:       string | null;
}

const soDigitos = (v?: string | null) => (v ?? "").replace(/\D/g, "");

/**
 * Formata valor no padrão do request de emissão do Itaú: centavos, sem ponto,
 * zero-preenchido em 17 dígitos. Ex.: 64.50 → "00000000000006450".
 */
function valorItau(n: number): string {
  return String(Math.round(n * 100)).padStart(17, "0");
}

/**
 * Registra um boleto no Itaú (carteira 109).
 *
 * O Nosso Número deve vir pronto (sequencial, sem repetir) — use
 * proximoNossoNumero() para gerá-lo de forma atômica.
 */
export async function emitirBoleto(params: {
  tenantId:    string;
  credenciais: CredenciaisItau;
  nomeBeneficiario: string;
  cnpjBeneficiario: string | null;
  pagador:     PagadorBoleto;
  valor:       number;
  vencimento:  Date;
  nossoNumero: string;
  seuNumero:   string;
}): Promise<ResultadoBoleto> {
  const { credenciais: c, pagador } = params;

  const idBeneficiario = montarIdBeneficiario(c.agencia, c.conta, c.contaDac);
  if (!idBeneficiario) throw new Error("Agência/conta/DAC do Itaú não configurados.");

  const token = await obterAccessToken(params.tenantId, c);

  const cnpjPag = soDigitos(pagador.cnpj);
  const cpfPag  = soDigitos(pagador.cpf);
  const ehPJ    = cnpjPag.length === 14;
  if (!ehPJ && cpfPag.length !== 11) {
    throw new Error("Pagador sem CPF/CNPJ válido — obrigatório para o boleto.");
  }

  const logradouro = [pagador.logradouro, pagador.numero, pagador.complemento]
    .filter(Boolean).join(", ");

  const payload = {
    // "validacao" não registra o título; "efetivacao" registra de verdade
    etapa_processo_boleto: c.ambiente === "Efetivacao" ? "efetivacao" : "validacao",
    codigo_canal_operacao: "API",
    beneficiario: {
      id_beneficiario: idBeneficiario,
      nome_cobranca:   params.nomeBeneficiario.slice(0, 30),
      ...(params.cnpjBeneficiario
        ? {
            tipo_pessoa: {
              codigo_tipo_pessoa: "J",
              numero_cadastro_nacional_pessoa_juridica: soDigitos(params.cnpjBeneficiario),
            },
          }
        : {}),
    },
    dado_boleto: {
      descricao_instrumento_cobranca: "boleto",
      tipo_boleto:     "a vista",
      codigo_carteira: ITAU_CARTEIRA,
      codigo_especie:  "01",             // Duplicata Mercantil
      descricao_especie: "Duplicata de Venda Mercantil",
      codigo_aceite:   "N",
      desconto_expresso: false,
      data_emissao:    new Date().toISOString().slice(0, 10),
      pagador: {
        pessoa: {
          nome_pessoa: pagador.nome.slice(0, 50),
          tipo_pessoa: ehPJ
            ? { codigo_tipo_pessoa: "J", numero_cadastro_nacional_pessoa_juridica: cnpjPag }
            : { codigo_tipo_pessoa: "F", numero_cadastro_pessoa_fisica: cpfPag },
        },
        endereco: {
          nome_logradouro: logradouro.slice(0, 45) || "Nao informado",
          nome_bairro:     (pagador.bairro ?? "").slice(0, 15) || "Nao informado",
          nome_cidade:     (pagador.cidade ?? "").slice(0, 20) || "Nao informado",
          sigla_UF:        (pagador.uf ?? "SP").slice(0, 2),
          numero_CEP:      soDigitos(pagador.cep) || "00000000",
        },
        ...(pagador.email ? { texto_endereco_email: pagador.email } : {}),
      },
      dados_individuais_boleto: [
        {
          numero_nosso_numero: params.nossoNumero,
          data_vencimento:     params.vencimento.toISOString().slice(0, 10),
          valor_titulo:        valorItau(params.valor),
          texto_seu_numero:    params.seuNumero.slice(0, 10),
        },
      ],
    },
  };

  // A API do Itaú exige o corpo dentro de um objeto "data" (mesmo padrão da
  // resposta e do webhook). Sem isso, ela responde "O campo data ... não pode
  // ser nulo".
  const corpo = JSON.stringify({ data: payload });
  const { status, data } = await requisicaoMtls(
    ITAU_URLS.boletos,
    {
      method: "POST",
      headers: {
        "Content-Type":         "application/json",
        "Content-Length":       Buffer.byteLength(corpo).toString(),
        Authorization:          `Bearer ${token}`,
        "x-itau-apikey":        c.clientId,
        "x-itau-correlationID": randomUUID(),
      },
      body: corpo,
    },
    c.certificado,
    c.chavePrivada,
  );

  if (status >= 400) {
    const msg = extrairErro(data);
    throw new Error(`Itaú recusou o boleto (HTTP ${status}): ${msg}`);
  }

  // A resposta traz os dados do título em dado_boleto.dados_individuais_boleto[0]
  const resp = data as {
    data?: Record<string, unknown>;
    dado_boleto?: { dados_individuais_boleto?: Array<Record<string, string>> };
    id_boleto?: string;
  };
  const raiz = (resp.data ?? resp) as typeof resp;
  const individual = raiz.dado_boleto?.dados_individuais_boleto?.[0] ?? {};

  return {
    nossoNumero:    individual.numero_nosso_numero ?? params.nossoNumero,
    linhaDigitavel: individual.numero_linha_digitavel ?? null,
    codigoBarras:   individual.codigo_barras ?? null,
    idBoleto:       (raiz.id_boleto as string | undefined) ?? null,
  };
}

// ─── Registro do webhook de cobrança no Itaú ─────────────────────────────────

/**
 * Cadastra no Itaú a URL de callback e as credenciais que ELE usará para nos
 * notificar a baixa dos boletos.
 */
export async function registrarWebhookItau(params: {
  tenantId:     string;
  credenciais:  CredenciaisItau;
  webhookClientId:     string;
  webhookClientSecret: string;
  baseUrl:      string;
  valorMinimo?: number;
}): Promise<{ status: number; data: unknown }> {
  const { credenciais: c } = params;
  const idBeneficiario = montarIdBeneficiario(c.agencia, c.conta, c.contaDac);
  if (!idBeneficiario) throw new Error("Agência/conta/DAC do Itaú não configurados.");

  const token = await obterAccessToken(params.tenantId, c);
  const base = params.baseUrl.replace(/\/$/, "");

  const corpo = JSON.stringify({
    data: {
      id_beneficiario:       idBeneficiario,
      webhook_url:           `${base}/api/webhooks/itau`,
      webhook_oauth_url:     `${base}/api/webhooks/itau/autorizacao`,
      webhook_client_id:     params.webhookClientId,
      webhook_client_secret: params.webhookClientSecret,
      valor_minimo:          params.valorMinimo ?? 0.01,
      tipos_notificacoes:    ["BAIXA_EFETIVA", "BAIXA_OPERACIONAL"],
    },
  });

  return requisicaoMtls(
    ITAU_URLS.notificacoes,
    {
      method: "POST",
      headers: {
        "Content-Type":         "application/json",
        "Content-Length":       Buffer.byteLength(corpo).toString(),
        Authorization:          `Bearer ${token}`,
        "x-itau-apikey":        c.clientId,
        "x-itau-correlationID": randomUUID(),
      },
      body: corpo,
    },
    c.certificado,
    c.chavePrivada,
  );
}

/** Lista os webhooks já cadastrados para o beneficiário. */
export async function consultarWebhookItau(params: {
  tenantId:    string;
  credenciais: CredenciaisItau;
}): Promise<{ status: number; data: unknown }> {
  const { credenciais: c } = params;
  const idBeneficiario = montarIdBeneficiario(c.agencia, c.conta, c.contaDac);
  if (!idBeneficiario) throw new Error("Agência/conta/DAC do Itaú não configurados.");

  const token = await obterAccessToken(params.tenantId, c);

  return requisicaoMtls(
    `${ITAU_URLS.notificacoes}?id_beneficiario=${idBeneficiario}`,
    {
      method: "GET",
      headers: {
        Authorization:          `Bearer ${token}`,
        "x-itau-apikey":        c.clientId,
        "x-itau-correlationID": randomUUID(),
      },
    },
    c.certificado,
    c.chavePrivada,
  );
}

/** Extrai a mensagem de erro do formato de resposta do Itaú. */
function extrairErro(data: unknown): string {
  const d = data as {
    mensagem?: string;
    campos?: Array<{ campo?: string; mensagem?: string }>;
    messages?: Array<{ mensagem?: string }>;
  };
  if (d?.campos?.length) {
    return d.campos.map((c) => `${c.campo}: ${c.mensagem}`).join("; ");
  }
  return d?.mensagem ?? d?.messages?.[0]?.mensagem ?? JSON.stringify(data).slice(0, 300);
}
