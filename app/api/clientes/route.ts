import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
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
    cnpj, cpf,
    cep, logradouro, numero, complemento, bairro, city, state, codigoCidade,
  } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email já cadastrado." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const client = await prisma.user.create({
    data: {
      tenantId,
      name,
      email,
      password: passwordHash,
      role:     "CLIENTE",
      cnpj:         cnpj         || null,
      cpf:          cpf          || null,
      cep:          cep          || null,
      logradouro:   logradouro   || null,
      numero:       numero       || null,
      complemento:  complemento  || null,
      bairro:       bairro       || null,
      city:         city         || null,
      state:        state        || null,
      codigoCidade: codigoCidade || null,
    },
  });

  return NextResponse.json(client, { status: 201 });
}
