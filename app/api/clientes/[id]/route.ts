import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const {
    name, email, password,
    cnpj, cpf, ie, phone,
    cep, logradouro, numero, complemento, bairro, city, state, codigoCidade,
    financeiroNome, financeiroEmail, financeiroPhone,
    decisorNome, decisorEmail, decisorPhone,
    observacoes, active,
  } = body;

  // Garante que o cliente pertence a este tenant
  const existing = await prisma.user.findFirst({
    where: { id, tenantId, role: "CLIENTE" },
  });
  if (!existing) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  // Se estiver trocando o email, verifica duplicata
  if (email && email !== existing.email) {
    const dup = await prisma.user.findUnique({ where: { email } });
    if (dup) return NextResponse.json({ error: "Email já cadastrado." }, { status: 409 });
  }

  const data: Record<string, unknown> = {
    name:            name           ?? existing.name,
    email:           email          ?? existing.email,
    phone:           phone          !== undefined ? phone   || null : existing.phone,
    cnpj:            cnpj           !== undefined ? cnpj    || null : existing.cnpj,
    cpf:             cpf            !== undefined ? cpf     || null : existing.cpf,
    ie:              ie             !== undefined ? ie      || null : existing.ie,
    cep:             cep            !== undefined ? cep     || null : existing.cep,
    logradouro:      logradouro     !== undefined ? logradouro     || null : existing.logradouro,
    numero:          numero         !== undefined ? numero         || null : existing.numero,
    complemento:     complemento    !== undefined ? complemento    || null : existing.complemento,
    bairro:          bairro         !== undefined ? bairro         || null : existing.bairro,
    city:            city           !== undefined ? city           || null : existing.city,
    state:           state          !== undefined ? state          || null : existing.state,
    codigoCidade:    codigoCidade   !== undefined ? codigoCidade   || null : existing.codigoCidade,
    financeiroNome:  financeiroNome  !== undefined ? financeiroNome  || null : existing.financeiroNome,
    financeiroEmail: financeiroEmail !== undefined ? financeiroEmail || null : existing.financeiroEmail,
    financeiroPhone: financeiroPhone !== undefined ? financeiroPhone || null : existing.financeiroPhone,
    decisorNome:     decisorNome    !== undefined ? decisorNome    || null : existing.decisorNome,
    decisorEmail:    decisorEmail   !== undefined ? decisorEmail   || null : existing.decisorEmail,
    decisorPhone:    decisorPhone   !== undefined ? decisorPhone   || null : existing.decisorPhone,
    observacoes:     observacoes    !== undefined ? observacoes    || null : existing.observacoes,
  };

  if (active !== undefined) data.active = active;

  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  const updated = await prisma.user.update({ where: { id }, data });
  return NextResponse.json(updated);
}
