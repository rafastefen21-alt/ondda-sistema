/**
 * POST /api/webhooks/itau
 *
 * Recebe do Itaú as notificações de baixa de boleto (BAIXA_EFETIVA /
 * BAIXA_OPERACIONAL) e marca o pagamento como PAGO.
 *
 * O Itaú autentica antes em /api/webhooks/itau/autorizacao e envia o token
 * obtido no header Authorization: Bearer.
 *
 * Cadastrar no Itaú como webhook_url.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarTokenWebhook } from "@/lib/itau";

interface BoletoNotificado {
  numeroNossoNumero?: string;
  idBoleto?: string;
  idBeneficiario?: string;
  codigoCarteira?: string;
  valorPagoTotalCobranca?: string;
  dataInclusaoPagamento?: string;
  numeroLinhaDigitavel?: string;
  codigoBarras?: string;
}

export async function POST(req: NextRequest) {
  // ── Autenticação ─────────────────────────────────────────────────────────
  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const sessao = verificarTokenWebhook(header.slice(7).trim());
  if (!sessao) {
    return NextResponse.json({ error: "token inválido ou expirado" }, { status: 401 });
  }

  // ── Payload ──────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => null);
  const boletos: BoletoNotificado[] = Array.isArray(body?.boletos) ? body.boletos : [];
  if (boletos.length === 0) {
    // Responde 200 para o Itaú não ficar reenviando um payload que não entendemos.
    console.warn("[webhook itau] payload sem boletos:", JSON.stringify(body)?.slice(0, 500));
    return NextResponse.json({ ok: true, processados: 0 });
  }

  let baixados = 0;
  const naoEncontrados: string[] = [];

  for (const b of boletos) {
    const nossoNumero = b.numeroNossoNumero?.trim();
    if (!nossoNumero) continue;

    // Casa pelo Nosso Número dentro do tenant autenticado
    const pagamento = await prisma.payment.findFirst({
      where: { tenantId: sessao.tenantId, itauNossoNumero: nossoNumero },
      select: { id: true, status: true },
    });

    if (!pagamento) {
      naoEncontrados.push(nossoNumero);
      continue;
    }
    if (pagamento.status === "PAGO") continue; // idempotente

    const pagoEm = b.dataInclusaoPagamento
      ? new Date(`${b.dataInclusaoPagamento}T12:00:00`)
      : new Date();

    await prisma.payment.update({
      where: { id: pagamento.id },
      data: {
        status: "PAGO",
        paidAt: isNaN(pagoEm.getTime()) ? new Date() : pagoEm,
        ...(b.idBoleto            ? { itauIdBoleto:   b.idBoleto } : {}),
        ...(b.numeroLinhaDigitavel ? { linhaDigitavel: b.numeroLinhaDigitavel } : {}),
        ...(b.codigoBarras         ? { codigoBarras:   b.codigoBarras } : {}),
      },
    });
    baixados++;
  }

  if (naoEncontrados.length > 0) {
    console.warn("[webhook itau] nosso_numero sem pagamento:", naoEncontrados.join(", "));
  }

  return NextResponse.json({ ok: true, processados: boletos.length, baixados });
}
