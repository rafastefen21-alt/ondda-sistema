/**
 * Tipos e defaults para configurações de notificações automáticas por tenant.
 * Persistido como JSON no campo Tenant.notificacoes.
 */

export interface TenantNotificacoes {
  email: {
    statusAtualizado:    boolean;
    cobrancaGerada:      boolean;
    pagamentoConfirmado: boolean;
    nfeEmitida:          boolean;
  };
  whatsapp: {
    statusAprovado:      boolean;
    statusEmProducao:    boolean;
    statusPronto:        boolean;
    statusEmEntrega:     boolean;
    statusEntregue:      boolean;
    statusCancelado:     boolean;
    cobrancaGerada:      boolean;
    pagamentoConfirmado: boolean;
  };
  mensagens: {
    statusAprovado:      string;
    statusEmProducao:    string;
    statusPronto:        string;
    statusEmEntrega:     string;
    statusEntregue:      string;
    statusCancelado:     string;
    cobrancaGerada:      string;
    pagamentoConfirmado: string;
  };
  /** Lembretes de vencimento de boleto por WhatsApp (enviados pelo cron diário). */
  lembretes: {
    ativo:          boolean;
    diasAntes:      number[];   // ex.: [7, 2]
    templateNome:   string;     // nome do modelo aprovado na Meta (ex.: lembrete_vencimento_boleto)
    templateIdioma: string;     // ex.: pt_BR
  };
}

/**
 * Corpo sugerido do modelo a cadastrar/aprovar na Meta (categoria UTILIDADE).
 * Os parâmetros são enviados nesta ordem:
 *   {{1}} nome do cliente   {{2}} distribuidora   {{3}} nº do pedido
 *   {{4}} valor             {{5}} vencimento      {{6}} linha digitável
 */
export const LEMBRETE_TEMPLATE_NOME = "lembrete_vencimento_boleto";
export const LEMBRETE_TEMPLATE_CORPO =
  "Olá, {{1}}! Aqui é a {{2}}. 😊 Passando para lembrar que o boleto do pedido #{{3}}, " +
  "no valor de {{4}}, vence em {{5}}.\n\n" +
  "Linha digitável:\n{{6}}\n\n" +
  "Se o pagamento já foi feito, por favor desconsidere esta mensagem. Qualquer dúvida, é só responder por aqui.";

export const DEFAULT_NOTIFICACOES: TenantNotificacoes = {
  email: {
    statusAtualizado:    true,
    cobrancaGerada:      true,
    pagamentoConfirmado: true,
    nfeEmitida:          true,
  },
  whatsapp: {
    statusAprovado:      false,
    statusEmProducao:    false,
    statusPronto:        false,
    statusEmEntrega:     false,
    statusEntregue:      false,
    statusCancelado:     false,
    cobrancaGerada:      false,
    pagamentoConfirmado: false,
  },
  mensagens: {
    statusAprovado:      "Olá {nome}! Seu pedido #{pedido} foi aprovado e está sendo preparado. 🎉",
    statusEmProducao:    "Olá {nome}! Seu pedido #{pedido} entrou em produção. 🏭",
    statusPronto:        "Olá {nome}! Seu pedido #{pedido} está pronto para entrega. 📦",
    statusEmEntrega:     "Olá {nome}! Seu pedido #{pedido} saiu para entrega. 🚚",
    statusEntregue:      "Olá {nome}! Pedido #{pedido} entregue com sucesso! Obrigado pela preferência. ✅",
    statusCancelado:     "Olá {nome}! Infelizmente seu pedido #{pedido} foi cancelado. Entre em contato conosco.",
    cobrancaGerada:      "Olá {nome}! Seu pedido #{pedido} no valor de {valor} aguarda pagamento. O link foi enviado por e-mail.",
    pagamentoConfirmado: "Olá {nome}! Recebemos o pagamento do pedido #{pedido} de {valor}. Obrigado! 🎉",
  },
  lembretes: {
    ativo:          false,
    diasAntes:      [7, 2],
    templateNome:   LEMBRETE_TEMPLATE_NOME,
    templateIdioma: "pt_BR",
  },
};

/** Mescla as configurações salvas com os defaults (safe merge). */
export function mergeNotificacoes(saved: unknown): TenantNotificacoes {
  if (!saved || typeof saved !== "object") return DEFAULT_NOTIFICACOES;
  const s = saved as Partial<TenantNotificacoes>;
  const lembretes = { ...DEFAULT_NOTIFICACOES.lembretes, ...(s.lembretes ?? {}) };
  // Saneia os dias: inteiros entre 0 e 60, sem repetição, do maior para o menor
  lembretes.diasAntes = [...new Set(
    (Array.isArray(lembretes.diasAntes) ? lembretes.diasAntes : [])
      .map((d) => Math.trunc(Number(d)))
      .filter((d) => Number.isFinite(d) && d >= 0 && d <= 60),
  )].sort((a, b) => b - a);
  return {
    email: { ...DEFAULT_NOTIFICACOES.email,     ...(s.email     ?? {}) },
    whatsapp: { ...DEFAULT_NOTIFICACOES.whatsapp, ...(s.whatsapp ?? {}) },
    mensagens: { ...DEFAULT_NOTIFICACOES.mensagens, ...(s.mensagens ?? {}) },
    lembretes,
  };
}

/** Substitui {nome}, {pedido}, {valor} na mensagem. */
export function renderNotifMessage(
  template: string,
  vars: { nome?: string; pedido?: string; valor?: string },
): string {
  return template
    .replace(/\{nome\}/gi,   vars.nome   ?? "")
    .replace(/\{pedido\}/gi, vars.pedido ?? "")
    .replace(/\{valor\}/gi,  vars.valor  ?? "");
}

/** Mapa: status do pedido → chave de mensagem / toggle de WhatsApp. */
export const STATUS_TO_WA_KEY: Record<string, keyof TenantNotificacoes["whatsapp"]> = {
  APROVADO:    "statusAprovado",
  EM_PRODUCAO: "statusEmProducao",
  PRONTO:      "statusPronto",
  EM_ENTREGA:  "statusEmEntrega",
  ENTREGUE:    "statusEntregue",
  CANCELADO:   "statusCancelado",
};

export const STATUS_TO_MSG_KEY: Record<string, keyof TenantNotificacoes["mensagens"]> = {
  APROVADO:    "statusAprovado",
  EM_PRODUCAO: "statusEmProducao",
  PRONTO:      "statusPronto",
  EM_ENTREGA:  "statusEmEntrega",
  ENTREGUE:    "statusEntregue",
  CANCELADO:   "statusCancelado",
};
