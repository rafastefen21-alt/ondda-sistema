/**
 * Inbox de WhatsApp (Datafy) — recebimento e persistência de conversas.
 *
 * Cada número vira uma WaConversation (única por tenant + telefone), sempre
 * ligada a um card do CRM. Mensagens recebidas (IN) e enviadas (OUT) ficam em
 * WaMessage. A conversa aparece dentro do card no CRM.
 */

import { prisma } from "@/lib/prisma";
import { formatPhone } from "@/lib/zapi";

type ClientLite = { id: string; name: string | null };

/** Procura um cliente cadastrado cujo telefone (principal/decisor/financeiro) casa com o número. */
async function findClientByPhone(tenantId: string, phone: string): Promise<ClientLite | null> {
  const candidates = await prisma.user.findMany({
    where: { tenantId, role: "CLIENTE" },
    select: { id: true, name: true, phone: true, decisorPhone: true, financeiroPhone: true },
  });
  for (const c of candidates) {
    for (const p of [c.phone, c.decisorPhone, c.financeiroPhone]) {
      if (p && formatPhone(p) === phone) return { id: c.id, name: c.name };
    }
  }
  return null;
}

/** Garante um card de CRM para a conversa: reaproveita um existente ou cria um novo em "Primeiro Contato". */
async function ensureCard(
  tenantId: string,
  phone: string,
  contactName: string | undefined,
  client: ClientLite | null,
): Promise<{ id: string }> {
  // 1) Card já existente do cliente (sem conversa vinculada ainda)
  if (client) {
    const byClient = await prisma.crmCard.findFirst({
      where: { tenantId, clientId: client.id, waConversation: { is: null } },
      select: { id: true },
    });
    if (byClient) return byClient;
  }
  // 2) Card avulso cujo telefone bate com o número
  const withPhone = await prisma.crmCard.findMany({
    where: { tenantId, leadPhone: { not: null }, waConversation: { is: null } },
    select: { id: true, leadPhone: true },
  });
  const match = withPhone.find((c) => c.leadPhone && formatPhone(c.leadPhone) === phone);
  if (match) return { id: match.id };
  // 3) Cria um card novo
  return prisma.crmCard.create({
    data: {
      tenantId,
      tab: "NOVOS",
      stage: "PRIMEIRO_CONTATO",
      leadName: contactName ?? client?.name ?? phone,
      leadPhone: phone,
      leadSource: "whatsapp",
      clientId: client?.id ?? null,
    },
    select: { id: true },
  });
}

/** Obtém (ou cria) a conversa de um número, já vinculada a cliente e card. */
export async function ensureConversation(
  tenantId: string,
  phoneRaw: string,
  contactName?: string,
) {
  const phone = formatPhone(phoneRaw);
  const existing = await prisma.waConversation.findUnique({
    where: { tenantId_phone: { tenantId, phone } },
  });
  if (existing) {
    if (contactName && !existing.contactName) {
      return prisma.waConversation.update({
        where: { id: existing.id },
        data: { contactName },
      });
    }
    return existing;
  }
  const client = await findClientByPhone(tenantId, phone);
  const card = await ensureCard(tenantId, phone, contactName, client);
  return prisma.waConversation.create({
    data: {
      tenantId,
      phone,
      contactName: contactName ?? null,
      clientId: client?.id ?? null,
      crmCardId: card.id,
    },
  });
}

/** Registra uma mensagem recebida (IN). Idempotente pelo id do provedor. */
export async function recordInbound(args: {
  tenantId: string;
  phoneRaw: string;
  contactName?: string;
  body: string;
  waMessageId?: string;
  timestamp?: number; // epoch em segundos (Meta Cloud API)
}) {
  const { tenantId, phoneRaw, contactName, body, waMessageId, timestamp } = args;

  if (waMessageId) {
    const dup = await prisma.waMessage.findFirst({
      where: { waMessageId, direction: "IN" },
      select: { id: true },
    });
    if (dup) return;
  }

  const convo = await ensureConversation(tenantId, phoneRaw, contactName);
  const when = timestamp ? new Date(timestamp * 1000) : new Date();

  await prisma.waMessage.create({
    data: {
      conversationId: convo.id,
      direction: "IN",
      body,
      type: "text",
      waMessageId: waMessageId ?? null,
      createdAt: when,
    },
  });
  await prisma.waConversation.update({
    where: { id: convo.id },
    data: {
      lastMessageAt: when,
      lastMessageText: body.slice(0, 240),
      lastDirection: "IN",
      unreadCount: { increment: 1 },
    },
  });
}

/** Obtém (ou cria) a conversa a partir de um card do CRM, para responder pelo card. */
export async function getOrCreateConversationForCard(
  tenantId: string,
  card: { id: string; leadPhone: string | null; clientPhone: string | null; leadName: string | null; clientId: string | null },
) {
  const byCard = await prisma.waConversation.findUnique({ where: { crmCardId: card.id } });
  if (byCard) return byCard;

  const phoneRaw = card.leadPhone ?? card.clientPhone;
  if (!phoneRaw) return null;
  const phone = formatPhone(phoneRaw);

  const byPhone = await prisma.waConversation.findUnique({
    where: { tenantId_phone: { tenantId, phone } },
  });
  if (byPhone) {
    if (!byPhone.crmCardId) {
      return prisma.waConversation.update({
        where: { id: byPhone.id },
        data: { crmCardId: card.id },
      });
    }
    return byPhone;
  }

  return prisma.waConversation.create({
    data: {
      tenantId,
      phone,
      contactName: card.leadName ?? null,
      clientId: card.clientId ?? null,
      crmCardId: card.id,
    },
  });
}

/** Registra uma mensagem enviada (OUT) numa conversa existente. */
export async function recordOutbound(
  conversationId: string,
  args: { body: string; waMessageId?: string; authorName?: string | null; status?: string },
) {
  const now = new Date();
  await prisma.waMessage.create({
    data: {
      conversationId,
      direction: "OUT",
      body: args.body,
      type: "text",
      waMessageId: args.waMessageId ?? null,
      authorName: args.authorName ?? null,
      status: args.status ?? "sent",
      createdAt: now,
    },
  });
  await prisma.waConversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: now,
      lastMessageText: args.body.slice(0, 240),
      lastDirection: "OUT",
    },
  });
}

/** Atualiza o status de entrega de uma mensagem enviada (via recibo do webhook). */
export async function updateOutboundStatus(waMessageId: string, status: string) {
  await prisma.waMessage.updateMany({
    where: { waMessageId, direction: "OUT" },
    data: { status },
  });
}
