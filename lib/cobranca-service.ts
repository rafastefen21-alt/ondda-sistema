/**
 * Cobrança automática e emissão de boleto Itaú.
 *
 * - autoGerarCobranca: chamado ao aprovar o pedido. BOLETO+Itaú → emite boleto
 *   e envia por e-mail; PIX/cartão → link do Mercado Pago.
 * - emitirBoletoPagamento: emite o boleto Itaú para um pagamento JÁ existente
 *   (usado pelo botão "Gerar boleto Itaú" e reutilizado pelo fluxo automático).
 *
 * Nunca lança em autoGerarCobranca (falha silenciosa). emitirBoletoPagamento
 * lança para a rota reportar o erro ao operador.
 */

import { prisma } from "@/lib/prisma";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { sendCobrancaEmail, sendBoletoEmail } from "@/lib/email";
import { mergeNotificacoes, renderNotifMessage } from "@/lib/notificacoes";
import { zapiSendText } from "@/lib/zapi";
import { emitirBoleto, proximoNossoNumero } from "@/lib/itau";
import { renderBoletoPdfById } from "@/lib/boleto-pdf";

const fmtBrl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Emite o boleto Itaú para um pagamento existente e (opcionalmente) notifica o
 * cliente por e-mail (PDF anexado) e WhatsApp. Lança em caso de erro.
 */
export async function emitirBoletoPagamento(
  paymentId: string,
  tenantId: string,
  opts: { notificar?: boolean } = {},
): Promise<{ nossoNumero: string; linhaDigitavel: string | null; codigoBarras: string | null }> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId },
    include: {
      order: {
        include: {
          client: {
            select: {
              name: true, email: true, decisorEmail: true, nomeFantasia: true,
              phone: true, decisorPhone: true,
              cnpj: true, cpf: true, logradouro: true, numero: true, complemento: true,
              bairro: true, city: true, state: true, cep: true,
            },
          },
        },
      },
    },
  });
  if (!payment) throw new Error("Pagamento não encontrado.");
  if (payment.status === "PAGO") throw new Error("Este pagamento já está quitado.");
  if (payment.itauNossoNumero) throw new Error("Este pagamento já tem boleto Itaú gerado.");

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true, cnpj: true, emailRemetente: true,
      zapiInstanceId: true, zapiToken: true, notificacoes: true,
      itauClientId: true, itauClientSecret: true, itauCertificado: true,
      itauChavePrivada: true, itauAgencia: true, itauConta: true,
      itauContaDac: true, itauAmbiente: true,
    },
  });
  const itauPronto = !!(
    tenant?.itauClientId && tenant.itauClientSecret && tenant.itauCertificado &&
    tenant.itauChavePrivada && tenant.itauAgencia && tenant.itauConta && tenant.itauContaDac
  );
  if (!tenant || !itauPronto) {
    throw new Error("Itaú não configurado. Preencha as credenciais em Configurações → Integrações.");
  }

  const client = payment.order.client;
  const total = Number(payment.amount);
  const nossoNumero = await proximoNossoNumero(tenantId);

  const boleto = await emitirBoleto({
    tenantId,
    credenciais: {
      clientId:     tenant.itauClientId!,
      clientSecret: tenant.itauClientSecret!,
      certificado:  tenant.itauCertificado!,
      chavePrivada: tenant.itauChavePrivada!,
      agencia:      tenant.itauAgencia!,
      conta:        tenant.itauConta!,
      contaDac:     tenant.itauContaDac!,
      ambiente:     tenant.itauAmbiente ?? "Validacao",
    },
    nomeBeneficiario: tenant.name,
    cnpjBeneficiario: tenant.cnpj,
    pagador: {
      nome:        client.name ?? client.email,
      cnpj:        client.cnpj,
      cpf:         client.cpf,
      logradouro:  client.logradouro,
      numero:      client.numero,
      complemento: client.complemento,
      bairro:      client.bairro,
      cidade:      client.city,
      uf:          client.state,
      cep:         client.cep,
      email:       client.email,
    },
    valor:       total,
    vencimento:  payment.dueDate,
    nossoNumero,
    seuNumero:   payment.orderId.slice(-10).toUpperCase(),
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      itauNossoNumero: boleto.nossoNumero,
      itauIdBoleto:    boleto.idBoleto,
      linhaDigitavel:  boleto.linhaDigitavel,
      codigoBarras:    boleto.codigoBarras,
    },
  });

  if (opts.notificar && boleto.linhaDigitavel) {
    const notif = mergeNotificacoes(tenant.notificacoes);
    const clientName = client.nomeFantasia ?? client.name ?? client.email;
    const shortId = payment.orderId.slice(-8).toUpperCase();
    const recipients = [...new Set(
      [client.decisorEmail, client.email].filter(Boolean) as string[],
    )];
    const phone = client.phone ?? client.decisorPhone ?? null;

    if (notif.email.cobrancaGerada && recipients.length) {
      const pdf = await renderBoletoPdfById(payment.id, tenantId);
      if (pdf) {
        await sendBoletoEmail({
          to: recipients, tenantName: tenant.name, clientName, orderId: payment.orderId,
          total, linhaDigitavel: boleto.linhaDigitavel, pdf, dueDate: payment.dueDate,
          fromOverride: tenant.emailRemetente,
        });
      }
    }

    if (notif.whatsapp.cobrancaGerada && tenant.zapiInstanceId && tenant.zapiToken && phone) {
      const msg = renderNotifMessage(notif.mensagens.cobrancaGerada, {
        nome: clientName, pedido: shortId, valor: fmtBrl(total),
      }) + `\n\nBoleto (linha digitável):\n${boleto.linhaDigitavel}`;
      zapiSendText({ instanceId: tenant.zapiInstanceId, token: tenant.zapiToken }, phone, msg)
        .catch((e) => console.error("[BOLETO] WA error:", e));
    }
  }

  return boleto;
}

export async function autoGerarCobranca(orderId: string, tenantId: string): Promise<void> {
  try {
    const [order, tenant] = await Promise.all([
      prisma.order.findFirst({
        where: { id: orderId, tenantId },
        include: {
          client: {
            select: {
              name: true, email: true, decisorEmail: true, nomeFantasia: true,
              phone: true, decisorPhone: true, prazoBoletoDias: true,
            },
          },
          items: { include: { product: { select: { name: true } } } },
          payments: { where: { status: { in: ["PENDENTE", "PAGO"] } } },
        },
      }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true, mpAccessToken: true, emailRemetente: true,
          zapiInstanceId: true, zapiToken: true, notificacoes: true,
          itauClientId: true, itauCertificado: true, itauChavePrivada: true,
          itauConta: true, itauContaDac: true, itauClientSecret: true, itauAgencia: true,
        },
      }),
    ]);

    if (!order || !tenant) return;
    if (order.payments.length > 0) {
      console.log("[COBRANCA-AUTO] já existe cobrança para pedido", orderId);
      return;
    }

    const total = order.items.reduce(
      (s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0,
    );
    if (total <= 0) return;

    const metodo = order.paymentMethod ?? "PIX";
    const itauPronto = !!(
      tenant.itauClientId && tenant.itauClientSecret && tenant.itauCertificado &&
      tenant.itauChavePrivada && tenant.itauAgencia && tenant.itauConta && tenant.itauContaDac
    );
    const usaItau = metodo === "BOLETO" && itauPronto;

    if (!usaItau && !tenant.mpAccessToken) return;

    // Vencimento: boleto usa o prazo do cliente; senão, 3 dias
    const dueDate = new Date();
    const prazo = order.client.prazoBoletoDias;
    if (metodo === "BOLETO" && typeof prazo === "number" && prazo > 0) {
      dueDate.setDate(dueDate.getDate() + prazo);
    } else {
      dueDate.setDate(dueDate.getDate() + 3);
    }

    const payment = await prisma.payment.create({
      data: {
        tenantId, orderId, amount: total as never,
        method: metodo as never, dueDate, status: "PENDENTE",
      },
    });

    // ── BOLETO ITAÚ ──
    if (usaItau) {
      try {
        await emitirBoletoPagamento(payment.id, tenantId, { notificar: true });
        console.log("[COBRANCA-AUTO] boleto Itaú gerado para pedido", orderId);
      } catch (err) {
        console.error("[COBRANCA-AUTO] boleto Itaú falhou (pagamento fica pendente):", err);
      }
      return;
    }

    // ── MERCADO PAGO (PIX/cartão) ──
    if (!tenant.mpAccessToken) return;

    const mpClient = new MercadoPagoConfig({ accessToken: tenant.mpAccessToken });
    const preferenceApi = new Preference(mpClient);
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

    const itemTitle =
      order.items.length === 1
        ? order.items[0].product.name
        : `Pedido #${orderId.slice(-6).toUpperCase()} — ${tenant.name}`;

    const preference = await preferenceApi.create({
      body: {
        items: [{ id: payment.id.slice(-30), title: itemTitle, quantity: 1, unit_price: total, currency_id: "BRL" }],
        external_reference: payment.id,
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
        back_urls: {
          success: `${baseUrl}/pedidos/${orderId}`,
          failure: `${baseUrl}/pedidos/${orderId}`,
          pending: `${baseUrl}/pedidos/${orderId}`,
        },
        auto_return: "approved",
        statement_descriptor: tenant.name.slice(0, 22),
      },
    });

    const checkoutUrl = preference.sandbox_init_point ?? preference.init_point ?? null;
    if (checkoutUrl) {
      const notif = mergeNotificacoes(tenant.notificacoes);
      const clientName = order.client.nomeFantasia ?? order.client.name ?? order.client.email;
      const shortId = orderId.slice(-8).toUpperCase();
      const recipients = [...new Set(
        [order.client.decisorEmail, order.client.email].filter(Boolean) as string[],
      )];
      const phone = order.client.phone ?? order.client.decisorPhone ?? null;

      if (notif.email.cobrancaGerada && recipients.length) {
        await sendCobrancaEmail(
          recipients, tenant.name, clientName, orderId, total,
          checkoutUrl, dueDate, tenant.emailRemetente,
        );
      }
      if (notif.whatsapp.cobrancaGerada && tenant.zapiInstanceId && tenant.zapiToken && phone) {
        const msg = renderNotifMessage(notif.mensagens.cobrancaGerada, {
          nome: clientName, pedido: shortId, valor: fmtBrl(total),
        });
        zapiSendText({ instanceId: tenant.zapiInstanceId, token: tenant.zapiToken }, phone, msg)
          .catch((e) => console.error("[COBRANCA-AUTO] WA error:", e));
      }
      console.log("[COBRANCA-AUTO] cobrança MP gerada para pedido", orderId);
    }
  } catch (err) {
    console.error("[COBRANCA-AUTO] erro inesperado:", err);
  }
}
