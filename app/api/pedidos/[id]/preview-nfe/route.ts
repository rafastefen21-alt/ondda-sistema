import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildNfePayload, validateNfeReady, type NfeOrder, type NfeTenant } from "@/lib/nfe";

/**
 * GET /api/pedidos/[id]/preview-nfe
 * Retorna o JSON exato que seria enviado à Focus NF-e — sem enviar nada.
 * Usar apenas para diagnóstico / suporte.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { tenantId } = session.user;

  const order = await prisma.order.findFirst({
    where: { id, tenantId },
    include: {
      client: {
        select: {
          name: true, email: true,
          cpf: true, cnpj: true,
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
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true, cnpj: true, ie: true, cnae: true, regimeTributario: true,
      cep: true, logradouro: true, numero: true, complemento: true,
      bairro: true, city: true, state: true, codigoCidade: true, phone: true,
      focusNfeToken: true, nfeAmbiente: true,
    },
  });

  const nfeOrder: NfeOrder = {
    id:       order.id,
    client:   order.client,
    items:    order.items.map((i) => ({
      product:   i.product,
      quantity:  Number(i.quantity),
      unitPrice: Number(i.unitPrice),
    })),
    payments: order.payments.map((p) => ({
      method: p.method,
      amount: Number(p.amount),
    })),
  };

  const nfeTenant: NfeTenant = {
    name:             tenant?.name ?? "",
    cnpj:             tenant?.cnpj ?? null,
    ie:               tenant?.ie ?? null,
    cnae:             tenant?.cnae ?? null,
    regimeTributario: tenant?.regimeTributario ?? null,
    cep:              tenant?.cep ?? null,
    logradouro:       tenant?.logradouro ?? null,
    numero:           tenant?.numero ?? null,
    complemento:      tenant?.complemento ?? null,
    bairro:           tenant?.bairro ?? null,
    city:             tenant?.city ?? null,
    state:            tenant?.state ?? null,
    codigoCidade:     tenant?.codigoCidade ?? null,
    phone:            tenant?.phone ?? null,
  };

  const validation = validateNfeReady(nfeOrder, nfeTenant);
  const payload    = buildNfePayload(nfeOrder, nfeTenant);

  const ambiente   = tenant?.nfeAmbiente ?? "homologacao";
  const urlFocus   = ambiente === "producao"
    ? `https://api.focusnfe.com.br/v2/nfe?ref=nfe-${id.slice(-16)}-vN`
    : `https://homologacao.focusnfe.com.br/v2/nfe?ref=nfe-${id.slice(-16)}-vN`;

  return NextResponse.json({
    urlFocus,
    ambiente,
    tokenPrefix: tenant?.focusNfeToken ? tenant.focusNfeToken.slice(0, 5) : null,
    validation,
    payload,
  });
}
