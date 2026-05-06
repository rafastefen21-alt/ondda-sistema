import { Resend } from "resend";

// Lazy — só instancia quando a função for chamada (evita erro de build sem a env)
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "noreply@ondda.com.br";

// ─── Labels de status ─────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<string, string> = {
  RASCUNHO:            "Rascunho",
  PENDENTE_APROVACAO:  "Aguardando aprovação",
  APROVADO:            "Aprovado ✅",
  EM_PRODUCAO:         "Em produção 🏭",
  PRONTO:              "Pronto para entrega 📦",
  EM_ENTREGA:          "Em rota de entrega 🚚",
  ENTREGUE:            "Entregue ✅",
  CANCELADO:           "Cancelado ❌",
};

const STATUS_COLOR: Record<string, string> = {
  RASCUNHO:           "#6b7280",
  PENDENTE_APROVACAO: "#d97706",
  APROVADO:           "#16a34a",
  EM_PRODUCAO:        "#2563eb",
  PRONTO:             "#7c3aed",
  EM_ENTREGA:         "#0891b2",
  ENTREGUE:           "#16a34a",
  CANCELADO:          "#dc2626",
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface OrderEmailData {
  orderId:      string;
  status:       string;
  tenantName:   string;
  clientName:   string;
  items: {
    productName: string;
    quantity:    number;
    unit:        string;
    unitPrice:   number;
  }[];
  scheduledDeliveryDate?: Date | null;
  appUrl?: string;
}

// ─── Template HTML ────────────────────────────────────────────────────────────

function orderStatusHtml(data: OrderEmailData): string {
  const {
    orderId, status, tenantName, clientName, items,
    scheduledDeliveryDate, appUrl,
  } = data;

  const statusLabel = STATUS_LABELS[status] ?? status;
  const statusColor = STATUS_COLOR[status]  ?? "#374151";
  const shortId     = orderId.slice(-8).toUpperCase();
  const total       = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const fmtBrl      = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const itemsHtml = items.map((i) => `
    <tr>
      <td style="padding:6px 0; font-size:14px; color:#374151; border-bottom:1px solid #f3f4f6;">
        ${i.productName}
      </td>
      <td style="padding:6px 0; font-size:14px; color:#6b7280; text-align:center; border-bottom:1px solid #f3f4f6;">
        ${i.quantity} ${i.unit}
      </td>
      <td style="padding:6px 0; font-size:14px; color:#374151; text-align:right; border-bottom:1px solid #f3f4f6;">
        ${fmtBrl(i.unitPrice * i.quantity)}
      </td>
    </tr>`).join("");

  const deliveryLine = scheduledDeliveryDate
    ? `<p style="margin:0 0 8px; font-size:14px; color:#374151;">
        <strong>Previsão de entrega:</strong>
        ${new Date(scheduledDeliveryDate).toLocaleDateString("pt-BR")}
      </p>`
    : "";

  const trackBtn = appUrl
    ? `<p style="text-align:center; margin:24px 0 0;">
        <a href="${appUrl}/pedidos/${orderId}"
           style="display:inline-block; background:#1e40af; color:#fff; text-decoration:none;
                  font-size:14px; font-weight:600; padding:12px 28px; border-radius:8px;">
          Acompanhar pedido
        </a>
       </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0; padding:0; background:#f9fafb; font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb; padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#fff; border-radius:12px; overflow:hidden;
                    border:1px solid #e5e7eb; max-width:560px; width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#1e40af; padding:24px 32px; text-align:center;">
            <p style="margin:0; font-size:18px; font-weight:700; color:#fff;">${tenantName}</p>
            <p style="margin:4px 0 0; font-size:13px; color:#bfdbfe;">Atualização do pedido #${shortId}</p>
          </td>
        </tr>

        <!-- Status pill -->
        <tr>
          <td style="padding:28px 32px 0; text-align:center;">
            <span style="display:inline-block; background:${statusColor}18;
                         color:${statusColor}; border:1px solid ${statusColor}40;
                         border-radius:999px; padding:6px 20px;
                         font-size:15px; font-weight:700;">
              ${statusLabel}
            </span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:24px 32px;">
            <p style="margin:0 0 16px; font-size:15px; color:#374151;">
              Olá, <strong>${clientName}</strong>!
            </p>
            <p style="margin:0 0 20px; font-size:14px; color:#6b7280;">
              O status do seu pedido <strong>#${shortId}</strong> foi atualizado para
              <strong style="color:${statusColor};">${statusLabel}</strong>.
            </p>

            ${deliveryLine}

            <!-- Itens -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:8px 12px; font-size:12px; color:#6b7280;
                              text-align:left; font-weight:600; text-transform:uppercase;">
                    Produto
                  </th>
                  <th style="padding:8px 12px; font-size:12px; color:#6b7280;
                              text-align:center; font-weight:600; text-transform:uppercase;">
                    Qtd.
                  </th>
                  <th style="padding:8px 12px; font-size:12px; color:#6b7280;
                              text-align:right; font-weight:600; text-transform:uppercase;">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody style="padding:0 12px;">
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr style="background:#f9fafb;">
                  <td colspan="2" style="padding:10px 12px; font-size:14px;
                                         font-weight:700; color:#111827; text-align:right;">
                    Total do pedido:
                  </td>
                  <td style="padding:10px 12px; font-size:15px; font-weight:700;
                              color:#1e40af; text-align:right;">
                    ${fmtBrl(total)}
                  </td>
                </tr>
              </tfoot>
            </table>

            ${trackBtn}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px; border-top:1px solid #f3f4f6; text-align:center;">
            <p style="margin:0; font-size:12px; color:#9ca3af;">
              Este email foi enviado automaticamente por ${tenantName}.<br>
              Em caso de dúvidas, entre em contato com a distribuidora.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Função pública ───────────────────────────────────────────────────────────

/**
 * Envia e-mail de atualização de status do pedido.
 * Não lança erro — falha silenciosa com log (para não quebrar o fluxo principal).
 */
export async function sendOrderStatusEmail(
  to: string | string[],
  data: OrderEmailData,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[EMAIL] RESEND_API_KEY não configurada — email não enviado.");
    return;
  }

  const recipients = Array.isArray(to) ? to : [to];
  const validRecipients = recipients.filter(Boolean);
  if (validRecipients.length === 0) return;

  const statusLabel = STATUS_LABELS[data.status] ?? data.status;
  const shortId     = data.orderId.slice(-8).toUpperCase();

  try {
    const result = await getResend().emails.send({
      from:    FROM,
      to:      validRecipients,
      subject: `Pedido #${shortId} — ${statusLabel} | ${data.tenantName}`,
      html:    orderStatusHtml(data),
    });
    console.log("[EMAIL] enviado para", validRecipients, result);
  } catch (err) {
    console.error("[EMAIL] erro ao enviar:", err);
  }
}
