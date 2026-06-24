import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { cancelNfe } from "@/lib/nfe";

const schema = z.object({
  justificativa: z.string().min(15).max(255),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId: session.user.tenantId },
  });
  if (!invoice) {
    return NextResponse.json({ error: "NF-e não encontrada" }, { status: 404 });
  }
  if (invoice.status !== "EMITIDA" || !invoice.focusNfeRef) {
    return NextResponse.json({ error: "Só é possível cancelar NF-e autorizada" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { focusNfeToken: true, nfeAmbiente: true },
  });
  if (!tenant?.focusNfeToken) {
    return NextResponse.json({ error: "Token Focus NF-e não configurado" }, { status: 400 });
  }

  const { httpStatus, data } = await cancelNfe(
    invoice.focusNfeRef,
    parsed.data.justificativa,
    tenant.focusNfeToken,
    tenant.nfeAmbiente ?? "homologacao",
  );

  if (httpStatus >= 400) {
    return NextResponse.json(
      { error: data?.erros?.[0]?.mensagem ?? data?.mensagem ?? "Erro ao cancelar NF-e", detail: data },
      { status: 422 },
    );
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data:  { status: "CANCELADA" },
  });

  return NextResponse.json({ ok: true });
}
