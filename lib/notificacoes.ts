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
}

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
};

/** Mescla as configurações salvas com os defaults (safe merge). */
export function mergeNotificacoes(saved: unknown): TenantNotificacoes {
  if (!saved || typeof saved !== "object") return DEFAULT_NOTIFICACOES;
  const s = saved as Partial<TenantNotificacoes>;
  return {
    email: { ...DEFAULT_NOTIFICACOES.email,     ...(s.email     ?? {}) },
    whatsapp: { ...DEFAULT_NOTIFICACOES.whatsapp, ...(s.whatsapp ?? {}) },
    mensagens: { ...DEFAULT_NOTIFICACOES.mensagens, ...(s.mensagens ?? {}) },
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
