import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { zapiSendText } from "@/lib/zapi";
import { getOrCreateConversationForCard, recordOutbound } from "@/lib/wa-inbox";

const ROLES = ["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"];

// GET — thread de mensagens do card (e marca a conversa como lida)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ROLES.includes(session.user.role)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const { tenantId } = session.user;

  const card = await prisma.crmCard.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      waConversation: { select: { id: true, phone: true, contactName: true, unreadCount: true } },
    },
  });
  if (!card) return NextResponse.json({ error: "Card não encontrado" }, { status: 404 });

  const convo = card.waConversation;
  if (!convo) return NextResponse.json({ conversation: null, messages: [] });

  const messages = await prisma.waMessage.findMany({
    where: { conversationId: convo.id },
    orderBy: { createdAt: "asc" },
    take: 300,
  });

  if (convo.unreadCount > 0) {
    await prisma.waConversation.update({ where: { id: convo.id }, data: { unreadCount: 0 } });
  }

  return NextResponse.json({
    conversation: { id: convo.id, phone: convo.phone, contactName: convo.contactName },
    messages: messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      status: m.status,
      authorName: m.authorName,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

// POST — envia uma resposta pelo WhatsApp e registra na conversa
const bodySchema = z.object({ message: z.string().min(1, "Mensagem não pode ser vazia") });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ROLES.includes(session.user.role)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const { tenantId } = session.user;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const card = await prisma.crmCard.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      leadPhone: true,
      leadName: true,
      clientId: true,
      client: { select: { phone: true } },
    },
  });
  if (!card) return NextResponse.json({ error: "Card não encontrado" }, { status: 404 });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { zapiInstanceId: true, zapiToken: true },
  });
  if (!tenant?.zapiInstanceId || !tenant?.zapiToken) {
    return NextResponse.json(
      { error: "WhatsApp (Datafy) não configurado. Vá em Configurações → Integrações." },
      { status: 400 },
    );
  }

  const convo = await getOrCreateConversationForCard(tenantId, {
    id: card.id,
    leadPhone: card.leadPhone,
    clientPhone: card.client?.phone ?? null,
    leadName: card.leadName,
    clientId: card.clientId,
  });
  if (!convo) {
    return NextResponse.json({ error: "Este card não tem número de WhatsApp." }, { status: 400 });
  }

  const result = await zapiSendText(
    { instanceId: tenant.zapiInstanceId, token: tenant.zapiToken },
    convo.phone,
    parsed.data.message,
  );
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Falha ao enviar a mensagem." }, { status: 502 });
  }

  await recordOutbound(convo.id, {
    body: parsed.data.message,
    waMessageId: result.zapiMessageId,
    authorName: session.user.name ?? null,
    status: "sent",
  });

  return NextResponse.json({
    ok: true,
    message: {
      direction: "OUT",
      body: parsed.data.message,
      status: "sent",
      authorName: session.user.name ?? null,
      createdAt: new Date().toISOString(),
    },
  });
}
