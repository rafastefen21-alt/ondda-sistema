/**
 * Serviço de emissão automática de NF-e.
 * Chamado pelo webhook do Mercado Pago após confirmação de pagamento.
 * Nunca lança exceção — falha silenciosa com log.
 */

import { prisma } from "@/lib/prisma";
import { validateNfeReady, buildNfePayload, submitNfe, checkNfeStatus } from "@/lib/nfe";
import { sendNfeEmail } from "@/lib/email";
import { mergeNotificacoes } from "@/lib/notificacoes";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Aguarda a autorização da NF-e na SEFAZ (consulta o status algumas vezes).
 * Retorna:
 *  - numero: preenchido quando autorizada;
 *  - aindaProcessando: true se, ao fim da janela, a NF continua em
 *    processamento (o boleto deve esperar); false se autorizou ou deu erro
 *    (o boleto pode seguir — com número, se houver).
 */
export async function aguardarAutorizacaoNfe(
  invoiceId: string,
  tenantId: string,
  tentativas = 6,
  delayMs = 1800,
): Promise<{ numero: string | null; aindaProcessando: boolean }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { focusNfeToken: true, nfeAmbiente: true },
  });
  if (!tenant?.focusNfeToken) return { numero: null, aindaProcessando: false };

  for (let i = 0; i < tentativas; i++) {
    await sleep(delayMs);
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice?.focusNfeRef) return { numero: null, aindaProcessando: false };
    if (invoice.status === "EMITIDA") return { numero: invoice.number, aindaProcessando: false };
    if (invoice.status === "ERRO" || invoice.status === "CANCELADA") return { numero: null, aindaProcessando: false };

    const { data } = await checkNfeStatus(
      invoice.focusNfeRef, tenant.focusNfeToken, tenant.nfeAmbiente ?? "homologacao",
    );
    const status =
      data.status === "autorizado" ? "EMITIDA" as const
      : data.status === "cancelado" ? "CANCELADA" as const
      : (data.status === "erro" || data.status === "rejeitado" || data.status === "denegado") ? "ERRO" as const
      : "PROCESSANDO" as const;

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status,
        number:    data.numero    ?? invoice.number,
        accessKey: data.chave_nfe ?? invoice.accessKey,
        xmlUrl:    data.caminho_xml_nota_fiscal ?? data.caminho_xml ?? invoice.xmlUrl,
        pdfUrl:    data.caminho_danfe ?? invoice.pdfUrl,
        issuedAt:  data.data_emissao ? new Date(data.data_emissao) : invoice.issuedAt,
        errorMsg:  data.erros ? JSON.stringify(data.erros).slice(0, 500) : invoice.errorMsg,
      },
    });

    if (status === "EMITIDA") return { numero: data.numero ?? null, aindaProcessando: false };
    if (status === "ERRO" || status === "CANCELADA") return { numero: null, aindaProcessando: false };
  }
  return { numero: null, aindaProcessando: true }; // ainda processando após a janela
}

/**
 * Emite a NF-e do pedido. Retorna o id do Invoice criado (ou null se não
 * emitiu — sem token, dados incompletos, já emitida, ou erro).
 */
export async function autoEmitirNfe(orderId: string, tenantId: string): Promise<string | null> {
  try {
    const [order, tenant] = await Promise.all([
      prisma.order.findFirst({
        where: { id: orderId, tenantId },
        include: {
          client: {
            select: {
              name: true, email: true, decisorEmail: true,
              cpf: true, cnpj: true, ie: true,
              cep: true, logradouro: true, numero: true,
              bairro: true, city: true, state: true, codigoCidade: true,
            },
          },
          items: {
            include: {
              product: { select: { id: true, name: true, unit: true, ncm: true, cfop: true } },
            },
          },
          payments: { select: { method: true, amount: true } },
          invoices: { select: { id: true, status: true, focusNfeRef: true } },
        },
      }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true, cnpj: true, ie: true, cnae: true, regimeTributario: true,
          cep: true, logradouro: true, numero: true, complemento: true,
          bairro: true, city: true, state: true, codigoCidade: true, phone: true,
          focusNfeToken: true, nfeAmbiente: true, emailRemetente: true, notificacoes: true,
        },
      }),
    ]);

    if (!order || !tenant?.focusNfeToken) return null;

    // Já existe NF-e emitida ou processando para este pedido
    const active = order.invoices.find(
      (inv) => inv.status === "EMITIDA" || inv.status === "PROCESSANDO",
    );
    if (active) {
      console.log("[NFE-AUTO] NF-e já existe para pedido", orderId);
      return active.id;
    }

    const nfeOrder = {
      id: order.id,
      client: order.client,
      items: order.items.map((i) => ({
        product: i.product,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
      })),
      payments: order.payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
      })),
    };

    const nfeTenant = {
      name: tenant.name,
      cnpj: tenant.cnpj,
      ie: tenant.ie,
      cnae: tenant.cnae,
      regimeTributario: tenant.regimeTributario,
      cep: tenant.cep,
      logradouro: tenant.logradouro,
      numero: tenant.numero,
      complemento: tenant.complemento,
      bairro: tenant.bairro,
      city: tenant.city,
      state: tenant.state,
      codigoCidade: tenant.codigoCidade,
      phone: tenant.phone,
    };

    const validation = validateNfeReady(nfeOrder, nfeTenant);
    if (!validation.valid) {
      console.log("[NFE-AUTO] dados insuficientes para emissão automática:", validation.missing);
      return null;
    }

    const emissionNumber = order.invoices.length + 1;
    const ref = `nfe-${order.id.slice(-16)}-v${emissionNumber}`;
    const payload = buildNfePayload(nfeOrder, nfeTenant);
    const ambiente = tenant.nfeAmbiente ?? "homologacao";

    const invoice = await prisma.invoice.create({
      data: { tenantId, orderId: order.id, focusNfeRef: ref, status: "PROCESSANDO" },
    });

    const { httpStatus, data: focusData } = await submitNfe(
      ref, payload, tenant.focusNfeToken, ambiente,
    );

    const mapStatus = (s?: string) => {
      if (s === "autorizado") return "EMITIDA" as const;
      if (s === "cancelado") return "CANCELADA" as const;
      if (s === "erro" || s === "rejeitado" || s === "denegado") return "ERRO" as const;
      return "PROCESSANDO" as const;
    };

    if (httpStatus >= 400) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "ERRO", errorMsg: JSON.stringify(focusData).slice(0, 500) },
      });
      console.error("[NFE-AUTO] erro Focus NF-e HTTP", httpStatus, focusData);
      return null;
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status:    mapStatus(focusData.status),
        number:    focusData.numero    ?? null,
        accessKey: focusData.chave_nfe ?? null,
        xmlUrl:    focusData.caminho_xml_nota_fiscal ?? focusData.caminho_xml ?? null,
        pdfUrl:    focusData.caminho_danfe ?? null,
        issuedAt:  focusData.data_emissao ? new Date(focusData.data_emissao) : null,
        errorMsg:  focusData.erros ? JSON.stringify(focusData.erros).slice(0, 500) : null,
      },
    });

    if (updated.status === "EMITIDA") {
      const notif = mergeNotificacoes(tenant.notificacoes);
      if (notif.email.nfeEmitida) {
        const recipients = [order.client.decisorEmail, order.client.email].filter(Boolean) as string[];
        await sendNfeEmail(
          [...new Set(recipients)],
          tenant.name,
          order.client.name ?? order.client.email,
          order.id,
          updated.pdfUrl,
          tenant.emailRemetente,
        ).catch((e) => console.error("[NFE-AUTO] erro email NF-e:", e));
      }
      console.log("[NFE-AUTO] NF-e emitida e email enviado para pedido", orderId);
    }
    return updated.id;
  } catch (err) {
    console.error("[NFE-AUTO] erro inesperado:", err);
    return null;
  }
}
