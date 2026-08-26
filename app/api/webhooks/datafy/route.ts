import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { recordInbound, updateOutboundStatus } from "@/lib/wa-inbox";

export const runtime = "nodejs";

/**
 * Webhook de recebimento do WhatsApp via Datafy (drop-in da Meta Cloud API).
 * As mensagens recebidas dos clientes entram no CRM como conversas/cards.
 *
 * Cadastre a URL deste endpoint no painel da Datafy:
 *   https://SEU_DOMINIO/api/webhooks/datafy
 */

// A Datafy/Meta faz um GET de verificação ao cadastrar a URL (hub.challenge).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const challenge = url.searchParams.get("hub.challenge");
  if (challenge) return new NextResponse(challenge, { status: 200 });
  return NextResponse.json({ status: "ok" });
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length || ba.length === 0) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Valida a assinatura HMAC-SHA256. Aceita dois formatos:
 *  - Meta:   HMAC(secret, corpoCru)                → header x-hub-signature-256: sha256=...
 *  - Datafy: HMAC(secret, `${timestamp}.${corpo}`) → header x-datafy-signature-256
 */
function verifySignature(
  secret: string,
  raw: string,
  signature: string | null,
  timestamp: string | null,
): boolean {
  if (!signature) return false;
  const provided = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  const candidates = [crypto.createHmac("sha256", secret).update(raw).digest("hex")];
  if (timestamp) {
    candidates.push(crypto.createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex"));
  }
  return candidates.some((c) => safeEqualHex(c, provided));
}

/** Extrai um texto legível de uma mensagem da Cloud API (texto, botão, mídia, etc.). */
function extractBody(m: Record<string, unknown>): string | null {
  const type = m?.type as string | undefined;
  switch (type) {
    case "text":
      return (m.text as { body?: string })?.body ?? "";
    case "button":
      return (m.button as { text?: string })?.text ?? "";
    case "interactive": {
      const it = m.interactive as {
        button_reply?: { title?: string };
        list_reply?: { title?: string };
      };
      return it?.button_reply?.title ?? it?.list_reply?.title ?? "";
    }
    case "image":
      return "[imagem]" + ((m.image as { caption?: string })?.caption ? ` ${(m.image as { caption?: string }).caption}` : "");
    case "audio":
      return "[áudio]";
    case "video":
      return "[vídeo]" + ((m.video as { caption?: string })?.caption ? ` ${(m.video as { caption?: string }).caption}` : "");
    case "document":
      return "[documento]";
    case "sticker":
      return "[figurinha]";
    case "location":
      return "[localização]";
    case "contacts":
      return "[contato]";
    default:
      return type ? `[${type}]` : null;
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Responder 200 evita reentregas infinitas para corpos inválidos.
    return NextResponse.json({ status: "bad_json" });
  }

  const signature =
    req.headers.get("x-datafy-signature-256") ?? req.headers.get("x-hub-signature-256");
  const dfTimestamp = req.headers.get("x-datafy-timestamp");

  const entries = Array.isArray(payload?.entry) ? (payload.entry as Record<string, unknown>[]) : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? (entry.changes as Record<string, unknown>[]) : [];
    for (const change of changes) {
      const value = change?.value as Record<string, unknown> | undefined;
      if (!value) continue;

      const metadata = value.metadata as { phone_number_id?: string } | undefined;
      const phoneNumberId = metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      // Descobre o tenant pelo Phone Number ID (guardado em zapiInstanceId).
      const tenant = await prisma.tenant.findFirst({
        where: { zapiInstanceId: String(phoneNumberId) },
        select: { id: true, datafyWebhookSecret: true },
      });
      if (!tenant) continue;

      // Se houver segredo cadastrado, exige assinatura válida.
      if (tenant.datafyWebhookSecret) {
        if (!verifySignature(tenant.datafyWebhookSecret, raw, signature, dfTimestamp)) {
          return NextResponse.json({ status: "invalid_signature" }, { status: 401 });
        }
      }

      // Nome do perfil por wa_id.
      const contacts = Array.isArray(value.contacts) ? (value.contacts as Record<string, unknown>[]) : [];
      const nameByWaId: Record<string, string | null> = {};
      for (const c of contacts) {
        const waId = c?.wa_id as string | undefined;
        if (waId) nameByWaId[String(waId)] = (c?.profile as { name?: string })?.name ?? null;
      }

      // Mensagens recebidas.
      const messages = Array.isArray(value.messages) ? (value.messages as Record<string, unknown>[]) : [];
      for (const m of messages) {
        const from = m?.from as string | undefined;
        if (!from) continue;
        const body = extractBody(m);
        if (body == null) continue;
        const tsRaw = m?.timestamp;
        const ts = tsRaw != null ? Number(tsRaw) : undefined;
        try {
          await recordInbound({
            tenantId: tenant.id,
            phoneRaw: String(from),
            contactName: nameByWaId[String(from)] ?? undefined,
            body,
            waMessageId: m?.id ? String(m.id) : undefined,
            timestamp: Number.isFinite(ts) ? ts : undefined,
          });
        } catch (err) {
          console.error("[datafy webhook] erro ao gravar mensagem recebida:", err);
        }
      }

      // Recibos de entrega das mensagens enviadas.
      const statuses = Array.isArray(value.statuses) ? (value.statuses as Record<string, unknown>[]) : [];
      for (const s of statuses) {
        const id = s?.id as string | undefined;
        const status = s?.status as string | undefined;
        if (id && status) {
          try {
            await updateOutboundStatus(String(id), String(status));
          } catch (err) {
            console.error("[datafy webhook] erro ao atualizar status:", err);
          }
        }
      }
    }
  }

  return NextResponse.json({ status: "ok" });
}
