import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MercadoPagoConfig, Payment as MpPayment } from "mercadopago";

// MP sends GET to verify the endpoint on setup
export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    // MP sends payment notifications as type "payment"
    if (type !== "payment" || !data?.id) {
      return NextResponse.json({ status: "ignored" });
    }

    const mpPaymentId = String(data.id);

    // Find which payment (and tenant) this belongs to
    // The external_reference on the preference points to our Payment.id
    // But the webhook gives us the MP payment id — we need to look it up
    // We'll find the tenant by looking at all tenants that have an mpAccessToken
    // and trying to fetch the payment from MP

    // First try: find our payment by mpPaymentId (if already linked)
    let payment = await prisma.payment.findFirst({
      where: { mpPaymentId },
      include: { order: { select: { tenantId: true } } },
    });

    // If not found by mpPaymentId, fetch from MP to get external_reference
    if (!payment) {
      // Try to find any tenant with MP configured to fetch the payment info
      const tenants = await prisma.tenant.findMany({
        where: { mpAccessToken: { not: null } },
        select: { id: true, mpAccessToken: true },
      });

      for (const tenant of tenants) {
        try {
          const mpClient = new MercadoPagoConfig({ accessToken: tenant.mpAccessToken! });
          const mpPaymentApi = new MpPayment(mpClient);
          const mpPayment = await mpPaymentApi.get({ id: Number(mpPaymentId) });

          const externalRef = (mpPayment as { external_reference?: string }).external_reference;
          if (!externalRef) continue;

          // external_reference is our Payment.id
          const found = await prisma.payment.findFirst({
            where: { id: externalRef, tenantId: tenant.id },
            include: { order: { select: { tenantId: true } } },
          });

          if (found) {
            payment = found;
            // Link the MP payment id for future webhooks
            await prisma.payment.update({
              where: { id: found.id },
              data: { mpPaymentId },
            });
            break;
          }
        } catch {
          // Not this tenant's payment, continue
          continue;
        }
      }
    }

    if (!payment) {
      return NextResponse.json({ status: "not_found" });
    }

    // Fetch actual MP payment status
    const tenantRecord = await prisma.tenant.findUnique({
      where: { id: payment.order.tenantId },
      select: { mpAccessToken: true },
    });

    if (!tenantRecord?.mpAccessToken) {
      return NextResponse.json({ status: "no_token" });
    }

    const mpClient2 = new MercadoPagoConfig({ accessToken: tenantRecord.mpAccessToken });
    const mpPaymentApi2 = new MpPayment(mpClient2);
    const mpPayment = await mpPaymentApi2.get({ id: Number(mpPaymentId) });
    const mpStatus = mpPayment.status;

    // Map MP status to our PaymentStatus
    let newStatus: "PAGO" | "PENDENTE" | "CANCELADO" | null = null;
    if (mpStatus === "approved") newStatus = "PAGO";
    else if (mpStatus === "cancelled" || mpStatus === "rejected") newStatus = "CANCELADO";
    else if (mpStatus === "pending" || mpStatus === "in_process") newStatus = "PENDENTE";

    if (newStatus && newStatus !== payment.status) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
          mpStatus,
          ...(newStatus === "PAGO" ? { paidAt: new Date() } : {}),
        },
      });
    }

    return NextResponse.json({ status: "processed" });
  } catch (err) {
    console.error("[MP Webhook] Error:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
