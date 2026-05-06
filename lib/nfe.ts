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
 * Monta o JSON para a API Focus NF-e v2 no formato FLAT (sem objetos aninhados).
 * Todos os campos do emitente levam sufixo _emitente; do destinatário, _destinatario.
 *
 * Referência: https://focusnfe.com.br/doc/#nfe-campos
 *
 * Premissas:
 *  - CSOSN 400 para Simples Nacional (não tributado / sem ST)
 *  - PIS/COFINS CST 07 (operação isenta)
 *  - local_destino detectado automaticamente (interna ou interestadual)
 */
export function buildNfePayload(order: NfeOrder, tenant: NfeTenant): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const regime     = parseInt(tenant.regimeTributario ?? "1", 10);
  const isSimples  = regime === 1 || regime === 2;
  const c          = order.client;

  // ── Totais ────────────────────────────────────────────────────────────────
  const valorProdutos = parseFloat(
    order.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0).toFixed(2)
  );

  // ── Destino (interna ou interestadual) ────────────────────────────────────
  const localDestino = (tenant.state && c.state && tenant.state !== c.state) ? 2 : 1;

  // ── Itens ─────────────────────────────────────────────────────────────────
  const items = order.items.map((item, idx) => {
    const qty   = Number(item.quantity);
    const price = Number(item.unitPrice);
    const cfop  = parseInt(item.product.cfop ?? (localDestino === 2 ? "6102" : "5102"), 10);
    // NCM como string com 8 dígitos — Focus NF-e espera character(8)
    const ncmStr = digits(item.product.ncm ?? "0").padStart(8, "0").slice(-8);

    const entry: Record<string, unknown> = {
      numero_item:               idx + 1,
      codigo_produto:            item.product.id.slice(-12).toUpperCase(),
      descricao:                 item.product.name,
      codigo_ncm:                ncmStr,
      cfop,
      unidade_comercial:         item.product.unit,
      quantidade_comercial:      qty,
      valor_unitario_comercial:  price,
      valor_unitario_tributavel: price,
      unidade_tributavel:        item.product.unit,
      quantidade_tributavel:     qty,
      valor_bruto:               parseFloat((qty * price).toFixed(2)),
      icms_origem:               0,   // 0 = nacional
      pis_situacao_tributaria:   "07",
      cofins_situacao_tributaria:"07",
    };

    if (isSimples) {
      // CSOSN 102 — Tributado pelo Simples Nacional sem permissão de crédito
      // Mais robusto que 400; gera <ICMSSN102> reconhecido por todos os SEFAZ
      entry.icms_csosn = "102";
    } else {
      // Regime Normal — isento (CST 41)
      entry.icms_situacao_tributaria = "41";
      entry.icms_base_calculo        = 0;
      entry.icms_aliquota            = 0;
      entry.icms_valor               = 0;
    }

    return entry;
  });

  // ── Pagamentos ────────────────────────────────────────────────────────────
  const formasPagamento = order.payments.length > 0
    ? order.payments.map((p) => ({
        forma_pagamento: PAYMENT_CODE[p.method] ?? "99",
        valor_pagamento: parseFloat(Number(p.amount).toFixed(2)),
      }))
    : [{ forma_pagamento: "99", valor_pagamento: valorProdutos }]; // sem cobrança cadastrada

  // ── Payload flat (sem objetos emitente/destinatario aninhados) ─────────────
  const payload: Record<string, unknown> = {
    // Cabeçalho
    natureza_operacao:  "Venda de mercadoria",
    data_emissao:       today,
    tipo_documento:     1,             // 1 = saída
    local_destino:      localDestino,  // 1 = interna | 2 = interestadual
    finalidade_emissao: 1,             // 1 = NF-e normal
    consumidor_final:   c.cnpj ? 0 : 1,
    presenca_comprador: 2,             // 2 = não presencial

    // Emitente — campos na raiz com sufixo _emitente
    cnpj_emitente:                normCnpj(tenant.cnpj ?? ""),
    nome_emitente:                tenant.name.trim(),
    logradouro_emitente:          tenant.logradouro ?? "",
    numero_emitente:              tenant.numero ?? "S/N",
    bairro_emitente:              tenant.bairro ?? "",
    municipio_emitente:           tenant.city ?? "",
    uf_emitente:                  tenant.state ?? "",
    cep_emitente:                 padCep(tenant.cep ?? ""),
    inscricao_estadual_emitente:  digits(tenant.ie ?? "") || "ISENTO",
    regime_tributario:            regime,

    // Destinatário — campos na raiz com sufixo _destinatario
    nome_destinatario:                    c.name ?? "Consumidor Final",
    email_destinatario:                   c.email,
    inscricao_estadual_destinatario:      null,

    // Totais
    valor_produtos:   valorProdutos,
    valor_total:      valorProdutos,
    valor_frete:      0,
    valor_seguro:     0,
    valor_desconto:   0,
    modalidade_frete: 9, // 9 = sem frete

    // Itens e pagamentos
    items,
    formas_pagamento: formasPagamento,
  };

  // Campos opcionais do emitente
  if (tenant.complemento)  payload.complemento_emitente  = tenant.complemento;
  if (tenant.phone)        payload.telefone_emitente     = digits(tenant.phone);
  if (tenant.cnae)         payload.cnae_fiscal           = parseInt(digits(tenant.cnae), 10); // sem sufixo _emitente
  // Código IBGE: só envia se for realmente um código de 7 dígitos (não nome da cidade)
  const ibgeEmitente = normIbge(tenant.codigoCidade);
  if (ibgeEmitente)        payload.codigo_municipio_emitente = ibgeEmitente;

  // Documento do destinatário — normaliza tamanho
  if (c.cnpj)      payload.cnpj_destinatario = normCnpj(c.cnpj);
  else if (c.cpf)  payload.cpf_destinatario  = normCpf(c.cpf);

  // Endereço do destinatário (se cadastrado)
  if (c.cep && c.logradouro && c.bairro && c.city && c.state) {
    payload.logradouro_destinatario  = c.logradouro;
    payload.numero_destinatario      = c.numero ?? "S/N";
    payload.bairro_destinatario      = c.bairro;
    payload.municipio_destinatario   = c.city;
    payload.uf_destinatario          = c.state;
    payload.cep_destinatario         = padCep(c.cep ?? "");
    payload.pais_destinatario        = "Brasil";
    const ibgeDest = normIbge(c.codigoCidade);
    if (ibgeDest) payload.codigo_municipio_destinatario = ibgeDest;
  }

  return payload;
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

/**
 * Normaliza CNPJ para exatamente 14 dígitos.
 * Se vier com 15 (erro de digitação com zero extra), remove o excesso.
 */
function normCnpj(value: string): string {
  const d = digits(value);
  if (d.length > 14) return d.slice(-14); // corta da direita (mantém dígitos verificadores)
  return d;
}

/**
 * Normaliza CPF para exatamente 11 dígitos (padding com zero à esquerda se necessário).
 */
function normCpf(value: string): string {
  return digits(value).padStart(11, "0").slice(-11);
}

/**
 * Normaliza CEP para exatamente 8 dígitos (padding com zero à esquerda se necessário).
 */
function padCep(value: string): string {
  return digits(value).padStart(8, "0").slice(-8);
}

/**
 * Retorna o código IBGE somente se for um número com 7 dígitos.
 * Rejeita valores que sejam nomes de cidade.
 */
function normIbge(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = digits(value);
  return d.length === 7 ? d : null;
}
