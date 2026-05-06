import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  validateNfeReady,
  buildNfePayload,
  submitNfe,
  checkNfeStatus,
  type NfeOrder,
  type NfeTenant,
} from "@/lib/nfe";

// ─── POST /api/pedidos/[id]/emitir-nfe ───────────────────────────────────────
// Emite a NF-e do pedido via Focus NF-e.
export async function POST(
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

  // ── 1. Busca o pedido completo ────────────────────────────────────────────
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
      invoices: { select: { id: true, status: true, focusNfeRef: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  // ── 2. Impede duplicata ───────────────────────────────────────────────────
  const active = order.invoices.find(
    (inv) => inv.status === "EMITIDA" || inv.status === "PROCESSANDO",
  );
  if (active) {
    return NextResponse.json(
      { error: "Já existe uma NF-e em processamento ou emitida para este pedido." },
      { status: 400 },
    );
  }

  // ── 3. Busca credenciais e dados fiscais do tenant ────────────────────────
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true, cnpj: true, ie: true, cnae: true, regimeTributario: true,
      cep: true, logradouro: true, numero: true, complemento: true,
      bairro: true, city: true, state: true, codigoCidade: true, phone: true,
      focusNfeToken: true, nfeAmbiente: true,
    },
  });

  if (!tenant?.focusNfeToken) {
    return NextResponse.json(
      { error: "Token Focus NF-e não configurado. Acesse Configurações → Integrações." },
      { status: 400 },
    );
  }

  // ── 4. Valida dados obrigatórios ──────────────────────────────────────────
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
    name:             tenant.name,
    cnpj:             tenant.cnpj,
    ie:               tenant.ie,
    cnae:             tenant.cnae,
    regimeTributario: tenant.regimeTributario,
    cep:              tenant.cep,
    logradouro:       tenant.logradouro,
    numero:           tenant.numero,
    complemento:      tenant.complemento,
    bairro:           tenant.bairro,
    city:             tenant.city,
    state:            tenant.state,
    codigoCidade:     tenant.codigoCidade,
    phone:            tenant.phone,
  };

  const validation = validateNfeReady(nfeOrder, nfeTenant);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Dados incompletos para emissão.", missing: validation.missing },
      { status: 422 },
    );
  }

  // ── 5. Monta payload ──────────────────────────────────────────────────────
  // Usa sufixo numérico para permitir re-emissão após cancelamento
  const emissionNumber = order.invoices.length + 1;
  const ref     = `nfe-${order.id.slice(-16)}-v${emissionNumber}`;
  const payload = buildNfePayload(nfeOrder, nfeTenant);

  // ── 6. Cria registro Invoice como PROCESSANDO ─────────────────────────────
  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      orderId:     order.id,
      focusNfeRef: ref,
      status:      "PROCESSANDO",
    },
  });

  // ── 7. Envia para a Focus NF-e ────────────────────────────────────────────
  const ambiente = tenant.nfeAmbiente ?? "homologacao";

  // Log de diagnóstico (visível em Vercel → Logs)
  const p = payload as Record<string, unknown>;
  console.log("[NFE-EMIT] tentando emitir", {
    ref,
    ambiente,
    tokenPrefix:     tenant.focusNfeToken.slice(0, 8) + "…",
    tokenLength:     tenant.focusNfeToken.length,
    cnpjEmitente:    p.cnpj_emitente,
    ieEmitente:      p.inscricao_estadual_emitente,
    tenantCnpjBruto: tenant.cnpj,
  });
  // Log do payload completo para suporte Focus NF-e (remover após resolver)
  console.log("[NFE-EMIT] payload completo", JSON.stringify(payload, null, 2));

  const { httpStatus, data: focusData } = await submitNfe(
    ref, payload, tenant.focusNfeToken, ambiente,
  );

  console.log("[NFE-EMIT] resposta Focus", {
    ref,
    httpStatus,
    focusData,
  });

  if (httpStatus >= 400) {
    // Salva o erro e devolve detalhes para o frontend
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status:   "ERRO",
        errorMsg: JSON.stringify(focusData).slice(0, 500),
      },
    });
    return NextResponse.json(
      {
        error: "Erro ao emitir NF-e na Focus NF-e.",
        details: focusData,
        debug: {
          ambiente,
          cnpjEnviado: p.cnpj_emitente,
          ieEnviada:   p.inscricao_estadual_emitente,
          tokenPrefix: tenant.focusNfeToken.slice(0, 8) + "…",
        },
      },
      { status: 502 },
    );
  }

  // ── 8. Atualiza o registro com os dados retornados ────────────────────────
  // A Focus NF-e pode retornar 201 (criada) ou 200 (já existia).
  // O status real (autorizada/rejeitada) vem via webhook ou consulta posterior.
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status:    mapFocusStatus(focusData.status),
      number:    focusData.numero      ?? null,
      accessKey: focusData.chave_nfe   ?? null,
      xmlUrl:    focusData.caminho_xml  ?? null,
      pdfUrl:    focusData.caminho_danfe ?? null,
      issuedAt:  focusData.data_emissao
        ? new Date(focusData.data_emissao)
        : null,
      errorMsg:  focusData.erros
        ? JSON.stringify(focusData.erros).slice(0, 500)
        : null,
    },
  });

  return NextResponse.json({ invoice: updated, focusData }, { status: 201 });
}

// ─── GET /api/pedidos/[id]/emitir-nfe ────────────────────────────────────────
// Consulta o status atualizado das NF-es do pedido na Focus NF-e.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { tenantId } = session.user;

  const [invoices, tenant] = await Promise.all([
    prisma.invoice.findMany({ where: { orderId: id, tenantId } }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { focusNfeToken: true, nfeAmbiente: true },
    }),
  ]);

  if (!tenant?.focusNfeToken) {
    return NextResponse.json({ invoices });
  }

  // Atualiza cada invoice ainda em PROCESSANDO
  const updates = await Promise.all(
    invoices
      .filter((inv) => inv.status === "PROCESSANDO" && inv.focusNfeRef)
      .map(async (inv) => {
        const { data } = await checkNfeStatus(
          inv.focusNfeRef!,
          tenant.focusNfeToken!,
          tenant.nfeAmbiente ?? "homologacao",
        );
        return prisma.invoice.update({
          where: { id: inv.id },
          data: {
            status:    mapFocusStatus(data.status),
            number:    data.numero       ?? inv.number,
            accessKey: data.chave_nfe    ?? inv.accessKey,
            xmlUrl:    data.caminho_xml   ?? inv.xmlUrl,
            pdfUrl:    data.caminho_danfe ?? inv.pdfUrl,
            issuedAt:  data.data_emissao
              ? new Date(data.data_emissao)
              : inv.issuedAt,
            errorMsg: data.erros
              ? JSON.stringify(data.erros).slice(0, 500)
              : inv.errorMsg,
          },
        });
      }),
  );

  const updatedIds = new Set(updates.map((u) => u.id));
  const final = invoices.map((inv) =>
    updatedIds.has(inv.id) ? updates.find((u) => u.id === inv.id)! : inv,
  );

  return NextResponse.json({ invoices: final });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapFocusStatus(status?: string) {
  switch (status) {
    case "autorizado":    return "EMITIDA"     as const;
    case "cancelado":     return "CANCELADA"   as const;
    case "erro":          return "ERRO"        as const;
    default:              return "PROCESSANDO" as const;
  }
}
