/**
 * lib/nfe.ts — Serviço de emissão de NF-e via Focus NF-e
 *
 * Fluxo:
 *  1. validateNfeReady(order, tenant)  → lista o que está faltando
 *  2. buildNfePayload(order, tenant)   → monta o JSON para a API
 *  3. submitNfe(ref, payload, ...)     → envia para a Focus NF-e
 *  4. checkNfeStatus(ref, ...)         → consulta o resultado
 *  5. cancelNfe(ref, just, ...)        → cancela se necessário
 *
 * Documentação da API: https://focusnfe.com.br/doc/
 */

// ─── URLs base ────────────────────────────────────────────────────────────────
const FOCUS_URL: Record<string, string> = {
  homologacao: "https://homologacao.focusnfe.com.br/v2",
  producao:    "https://api.focusnfe.com.br/v2",
};

// ─── Mapeamento de forma de pagamento (Tabela A.14 NF-e) ──────────────────────
// TODO: ajuste conforme as formas de pagamento que você aceita
const PAYMENT_CODE: Record<string, string> = {
  PIX:            "17",
  BOLETO:         "15",
  CARTAO_CREDITO: "03",
  CARTAO_DEBITO:  "04",
  DINHEIRO:       "01",
  TRANSFERENCIA:  "17",
};

// ─── Tipos internos ───────────────────────────────────────────────────────────

export interface NfeTenant {
  name:             string;
  cnpj:             string | null;
  ie:               string | null;
  cnae:             string | null;
  regimeTributario: string | null;
  cep:              string | null;
  logradouro:       string | null;
  numero:           string | null;
  complemento:      string | null;
  bairro:           string | null;
  city:             string | null;
  state:            string | null;
  codigoCidade:     string | null;
  phone:            string | null;
}

export interface NfeClient {
  name:         string | null;
  email:        string;
  cpf:          string | null;
  cnpj:         string | null;
  cep:          string | null;
  logradouro:   string | null;
  numero:       string | null;
  bairro:       string | null;
  city:         string | null;
  state:        string | null;
  codigoCidade: string | null;
}

export interface NfeItem {
  product: {
    id:   string;
    name: string;
    unit: string;
    ncm:  string | null;
    cfop: string | null;
  };
  quantity:  number | string;
  unitPrice: number | string;
}

export interface NfePayment {
  method: string;
  amount: number | string;
}

export interface NfeOrder {
  id:       string;
  client:   NfeClient;
  items:    NfeItem[];
  payments: NfePayment[];
}

// ─── Validação ────────────────────────────────────────────────────────────────

export interface NfeValidation {
  valid:   boolean;
  missing: string[];
}

/**
 * Verifica se todos os dados necessários estão preenchidos antes de emitir.
 * Retorna a lista de campos faltantes com mensagens amigáveis.
 */
export function validateNfeReady(order: NfeOrder, tenant: NfeTenant): NfeValidation {
  const missing: string[] = [];

  // Empresa emitente
  if (!tenant.cnpj)             missing.push("CNPJ da empresa (Configurações → Dados Fiscais)");
  if (!tenant.ie)               missing.push("Inscrição Estadual da empresa");
  if (!tenant.cnae)             missing.push("CNAE da empresa");
  if (!tenant.regimeTributario) missing.push("Regime Tributário da empresa");
  if (!tenant.cep)              missing.push("CEP da empresa");
  if (!tenant.logradouro)       missing.push("Logradouro da empresa");
  if (!tenant.numero)           missing.push("Número do endereço da empresa");
  if (!tenant.bairro)           missing.push("Bairro da empresa");
  if (!tenant.city)             missing.push("Município da empresa");
  if (!tenant.state)            missing.push("UF da empresa");
  if (!tenant.codigoCidade)     missing.push("Código IBGE do município da empresa");

  // Destinatário
  if (!order.client.cpf && !order.client.cnpj) {
    missing.push(`CPF ou CNPJ do cliente "${order.client.name ?? order.client.email}"`);
  }

  // Produtos
  for (const item of order.items) {
    if (!item.product.ncm) {
      missing.push(`NCM do produto "${item.product.name}" (Produtos → Editar)`);
    }
  }

  return { valid: missing.length === 0, missing };
}

// ─── Builder do payload ───────────────────────────────────────────────────────

/**
 * Monta o JSON completo para envio à API Focus NF-e.
 *
 * Premissas (ajuste conforme necessário):
 *  - CSOSN 400: não tributado pelo ICMS (Simples Nacional sem substituição)
 *  - PIS/COFINS CST 07: operação isenta
 *  - local_destino 1 (interna) — detectado automaticamente se estados forem iguais
 *  - consumidor_final: 0 se cliente tem CNPJ, 1 se pessoa física
 *
 * TODO: revisar CSTs e alíquotas com seu contador antes de ir para produção.
 */
export function buildNfePayload(order: NfeOrder, tenant: NfeTenant): Record<string, unknown> {
  const now    = new Date().toISOString().replace("Z", "-03:00");
  const regime = parseInt(tenant.regimeTributario ?? "1", 10);
  const isSimples = regime === 1 || regime === 2;

  // ── Emitente ──────────────────────────────────────────────────────────────
  const emitente: Record<string, unknown> = {
    cnpj:               digits(tenant.cnpj ?? ""),
    nome:               tenant.name,
    logradouro:         tenant.logradouro ?? "",
    numero:             tenant.numero ?? "",
    bairro:             tenant.bairro ?? "",
    municipio:          tenant.city ?? "",
    uf:                 tenant.state ?? "",
    cep:                digits(tenant.cep ?? ""),
    codigo_municipio:   tenant.codigoCidade ?? "",
    inscricao_estadual: digits(tenant.ie ?? "") || "ISENTO",
    cnae_fiscal:        parseInt(digits(tenant.cnae ?? "0"), 10),
    regime_tributario:  regime,
  };
  if (tenant.complemento) emitente.complemento = tenant.complemento;
  if (tenant.phone)        emitente.telefone    = digits(tenant.phone);

  // ── Destinatário ──────────────────────────────────────────────────────────
  const c = order.client;
  const temEndereco = !!(c.cep && c.logradouro && c.bairro && c.city && c.state);
  const temDocumento = !!(c.cnpj || c.cpf);

  const destinatario: Record<string, unknown> = {
    nome:  c.name ?? "Consumidor Final",
    email: c.email,
  };

  if (c.cnpj) destinatario.cnpj = digits(c.cnpj);
  else if (c.cpf) destinatario.cpf = digits(c.cpf);

  if (temEndereco) {
    destinatario.logradouro       = c.logradouro ?? "";
    destinatario.numero           = c.numero     ?? "S/N";
    destinatario.bairro           = c.bairro     ?? "";
    destinatario.municipio        = c.city        ?? "";
    destinatario.uf               = c.state       ?? "";
    destinatario.cep              = digits(c.cep ?? "");
    destinatario.codigo_municipio = c.codigoCidade ?? "";
  }

  // ── Itens ─────────────────────────────────────────────────────────────────
  // Detecta operação interna ou interestadual automaticamente
  const localDestino = (tenant.state && c.state && tenant.state !== c.state) ? 2 : 1;

  const itens = order.items.map((item, idx) => {
    const qty   = Number(item.quantity);
    const price = Number(item.unitPrice);
    const cfop  = item.product.cfop
      ?? (localDestino === 2 ? "6102" : "5102"); // interestadual → 6102

    const entry: Record<string, unknown> = {
      numero_item:              idx + 1,
      codigo_produto:           item.product.id.slice(-12).toUpperCase(),
      descricao:                item.product.name,
      codigo_ncm:               digits(item.product.ncm ?? ""),
      cfop,
      unidade_comercial:        item.product.unit,
      quantidade_comercial:     qty,
      valor_unitario_comercial: price,
      valor_bruto:              parseFloat((qty * price).toFixed(2)),
      // ICMS
      icms_origem: 0, // 0 = nacional
      // TODO: revisar CSOSN/CST com seu contador
      ...(isSimples
        ? { icms_csosn: "400" }                                    // Simples Nacional — não tributado
        : { icms_situacao_tributaria: "41", icms_aliquota: 0 }),   // Regime Normal — isento
      // PIS / COFINS
      // TODO: ajustar CSTs conforme apuração
      pis_situacao_tributaria:    "07",  // isento
      cofins_situacao_tributaria: "07",  // isento
    };
    return entry;
  });

  // ── Pagamentos ────────────────────────────────────────────────────────────
  const pagamentos = order.payments.map((p) => ({
    forma_pagamento: PAYMENT_CODE[p.method] ?? "99",
    valor_pagamento: parseFloat(Number(p.amount).toFixed(2)),
  }));

  // ── Payload final ─────────────────────────────────────────────────────────
  return {
    natureza_operacao:  "Venda de mercadoria",
    data_emissao:       now,
    tipo_documento:     1,            // 1 = saída
    local_destino:      localDestino, // 1 = interna | 2 = interestadual
    finalidade_emissao: 1,            // 1 = normal
    consumidor_final:   temDocumento && c.cnpj ? 0 : 1, // 0 = B2B, 1 = B2C
    presenca_comprador: 2,            // 2 = não presencial (internet/sistema)
    emitente,
    destinatario,
    itens,
    pagamentos,
  };
}

// ─── Chamadas à API Focus NF-e ────────────────────────────────────────────────

function focusAuth(token: string) {
  return "Basic " + Buffer.from(`${token}:`).toString("base64");
}

function focusBase(ambiente: string) {
  return FOCUS_URL[ambiente] ?? FOCUS_URL.homologacao;
}

/** Envia a NF-e para a SEFAZ via Focus NF-e. */
export async function submitNfe(
  ref:      string,
  payload:  object,
  token:    string,
  ambiente: string,
) {
  const url = `${focusBase(ambiente)}/nfe?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    method:  "POST",
    headers: { Authorization: focusAuth(token), "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  return { httpStatus: res.status, data: await res.json().catch(() => ({})) };
}

/** Consulta o status atual da NF-e na SEFAZ. */
export async function checkNfeStatus(
  ref:      string,
  token:    string,
  ambiente: string,
) {
  const url = `${focusBase(ambiente)}/nfe/${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    headers: { Authorization: focusAuth(token) },
  });
  return { httpStatus: res.status, data: await res.json().catch(() => ({})) };
}

/** Cancela uma NF-e já autorizada (prazo: até 24h após emissão). */
export async function cancelNfe(
  ref:           string,
  justificativa: string,
  token:         string,
  ambiente:      string,
) {
  const url = `${focusBase(ambiente)}/nfe/${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    method:  "DELETE",
    headers: { Authorization: focusAuth(token), "Content-Type": "application/json" },
    body:    JSON.stringify({ justificativa }),
  });
  return { httpStatus: res.status, data: await res.json().catch(() => ({})) };
}

/** Retorna o PDF DANFE de uma NF-e emitida. */
export function danfeUrl(ref: string, token: string, ambiente: string) {
  return `${focusBase(ambiente)}/nfe/${encodeURIComponent(ref)}/danfe`
    + `?token=${encodeURIComponent(token)}`;
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

/** Remove tudo que não for dígito (máscaras de CNPJ, CPF, CEP, etc.). */
function digits(value: string): string {
  return value.replace(/\D/g, "");
}
