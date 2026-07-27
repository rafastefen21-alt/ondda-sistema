/**
 * GET /api/clientes/exportar
 *
 * Exporta os clientes (dados + endereço) em CSV pronto para abrir no Excel
 * (UTF-8 com BOM e separador ";", padrão do Excel pt-BR).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Escapa um campo para CSV com separador ";". */
function cel(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[;"\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const clientes = await prisma.user.findMany({
    where: { tenantId: session.user.tenantId, role: "CLIENTE" },
    include: { _count: { select: { orders: true } } },
    orderBy: { name: "asc" },
  });

  const headers = [
    "Razão Social", "Nome Fantasia", "Email", "Telefone",
    "CNPJ", "CPF", "Inscrição Estadual",
    "CEP", "Logradouro", "Número", "Complemento", "Bairro", "Cidade", "UF", "Código IBGE",
    "Financeiro - Nome", "Financeiro - Email", "Financeiro - Telefone",
    "Decisor - Nome", "Decisor - Email", "Decisor - Telefone",
    "Prazo Boleto (dias)", "Status", "Qtd. Pedidos", "Observações", "Cadastrado em",
  ];

  const linhas = clientes.map((c) => [
    cel(c.name), cel(c.nomeFantasia), cel(c.email), cel(c.phone),
    cel(c.cnpj), cel(c.cpf), cel(c.ie),
    cel(c.cep), cel(c.logradouro), cel(c.numero), cel(c.complemento),
    cel(c.bairro), cel(c.city), cel(c.state), cel(c.codigoCidade),
    cel(c.financeiroNome), cel(c.financeiroEmail), cel(c.financeiroPhone),
    cel(c.decisorNome), cel(c.decisorEmail), cel(c.decisorPhone),
    cel(c.prazoBoletoDias), cel(c.active ? "Ativo" : "Inativo"),
    cel(c._count.orders),
    cel(c.observacoes),
    cel(new Date(c.createdAt).toLocaleDateString("pt-BR")),
  ].join(";"));

  // BOM (﻿) faz o Excel reconhecer UTF-8 e mostrar acentos corretamente
  const csv = "﻿" + [headers.join(";"), ...linhas].join("\r\n");

  const hoje = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-${hoje}.csv"`,
    },
  });
}
