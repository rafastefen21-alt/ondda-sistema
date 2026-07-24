/**
 * Gera cobrança automaticamente ao aprovar um pedido.
 * Chamado pelo PATCH /api/pedidos/[id] quando status → APROVADO.
 *
 * - Forma de pagamento BOLETO + Itaú configurado → emite boleto registrado no
 *   Itaú e envia o PDF por e-mail ao cliente.
 * - Demais formas (PIX/cartão) → gera link do Mercado Pago (como antes).
 *
 * Nunca lança exceção — falha silenciosa com log.
 */

import { prisma } from "@/lib/prisma";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { sendCobrancaEmail, sendBoletoEmail } from "@/lib/email";
import { mergeNotificacoes, renderNotifMessage } from "@/lib/notificacoes";
import { zapiSendText } from "@/lib/zapi";
import { emitirBoleto, proximoNossoNumero } from "@/lib/itau";
import { renderBoletoPdfById } from "@/lib/boleto-pdf";

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
              cnpj: true, cpf: true, logradouro: true, numero: true, complemento: true,
              bairro: true, city: true, state: true, cep: true,
            },
          },
          items: { include: { product: { select: { name: true } } } },
          // Não gera segunda cobrança se já tiver payment pendente ou pago
          payments: { where: { status: { in: ["PENDENTE", "PAGO"] } } },
        },
      }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true, cnpj: true, mpAccessToken: true, emailRemetente: true,
          zapiInstanceId: true, zapiToken: true, notificacoes: true,
          itauClientId: true, itauClientSecret: true, itauCertificado: true,
          itauChavePrivada: true, itauAgencia: true, itauConta: true,
          itauContaDac: true, itauAmbiente: true,
        },
      }),
    ]);

    if (!order || !tenant) return;

    // Já tem cobrança ativa
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

    // Nada a cobrar automaticamente (sem Itaú para boleto e sem MP)
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
        tenantId,
        orderId,
        amount: total as never,
        method: metodo as never,
        dueDate,
        status: "PENDENTE",
      },
    });

    const notif = mergeNotificacoes(tenant.notificacoes);
    const clientName = order.client.nomeFantasia ?? order.client.name ?? order.client.email;
    const shortId = orderId.slice(-8).toUpperCase();
    const fmtBrl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const recipients = [...new Set(
      [order.client.decisorEmail, order.client.email].filter(Boolean) as string[],
    )];
    const phone = order.client.phone ?? order.client.decisorPhone ?? null;

    // ── BOLETO ITAÚ ────────────────────────────────────────────────────────────
    if (usaItau) {
      try {
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
            nome:        order.client.name ?? order.client.email,
            cnpj:        order.client.cnpj,
            cpf:         order.client.cpf,
            logradouro:  order.client.logradouro,
            numero:      order.client.numero,
            complemento: order.client.complemento,
            bairro:      order.client.bairro,
            cidade:      order.client.city,
            uf:          order.client.state,
            cep:         order.client.cep,
            email:       order.client.email,
          },
          valor:       total,
          vencimento:  dueDate,
          nossoNumero,
          seuNumero:   orderId.slice(-10).toUpperCase(),
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

        // E-mail com o PDF anexado
        if (notif.email.cobrancaGerada && recipients.length && boleto.linhaDigitavel) {
          const pdf = await renderBoletoPdfById(payment.id, tenantId);
          if (pdf) {
            await sendBoletoEmail({
              to: recipients, tenantName: tenant.name, clientName, orderId, total,
              linhaDigitavel: boleto.linhaDigitavel, pdf, dueDate,
              fromOverride: tenant.emailRemetente,
            });
          }
        }

        // WhatsApp (opcional) com a linha digitável
        if (notif.whatsapp.cobrancaGerada && tenant.zapiInstanceId && tenant.zapiToken && phone && boleto.linhaDigitavel) {
          const msg = renderNotifMessage(notif.mensagens.cobrancaGerada, {
            nome: clientName, pedido: shortId, valor: fmtBrl(total),
          }) + `\n\nBoleto (linha digitável):\n${boleto.linhaDigitavel}`;
          zapiSendText({ instanceId: tenant.zapiInstanceId, token: tenant.zapiToken }, phone, msg)
            .catch((e) => console.error("[COBRANCA-AUTO] WA error:", e));
        }

        console.log("[COBRANCA-AUTO] boleto Itaú gerado para pedido", orderId);
      } catch (err) {
        console.error("[COBRANCA-AUTO] boleto Itaú falhou (pagamento fica pendente):", err);
      }
      return;
    }

    // ── MERCADO PAGO (PIX/cartão) ───────────────────────────────────────────────
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
      // E-mail
      if (notif.email.cobrancaGerada && recipients.length) {
        await sendCobrancaEmail(
          recipients, tenant.name, clientName, orderId, total,
          checkoutUrl, dueDate, tenant.emailRemetente,
        );
      }

      // WhatsApp
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
