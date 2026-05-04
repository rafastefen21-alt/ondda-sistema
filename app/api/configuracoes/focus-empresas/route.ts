import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/configuracoes/focus-empresas
// Diagnóstico: lista as empresas que o token Focus NF-e do tenant atual consegue acessar.
// Útil para descobrir se o token está apontando para a conta certa.
export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { focusNfeToken: true, nfeAmbiente: true, cnpj: true },
  });

  if (!tenant?.focusNfeToken) {
    return NextResponse.json({ error: "Token Focus não configurado." }, { status: 400 });
  }

  const ambiente = tenant.nfeAmbiente ?? "homologacao";
  const baseUrl = ambiente === "producao"
    ? "https://api.focusnfe.com.br/v2"
    : "https://homologacao.focusnfe.com.br/v2";

  const auth64 = Buffer.from(`${tenant.focusNfeToken}:`).toString("base64");

  const res = await fetch(`${baseUrl}/empresas`, {
    headers: { Authorization: `Basic ${auth64}` },
  });

  const data = await res.json().catch(() => ({}));

  return NextResponse.json({
    httpStatus: res.status,
    ambiente,
    tokenPrefix: tenant.focusNfeToken.slice(0, 8) + "…",
    tokenLength: tenant.focusNfeToken.length,
    cnpjTenantSistema: (tenant.cnpj ?? "").replace(/\D/g, ""),
    empresasNoFocus: data,
  });
}
