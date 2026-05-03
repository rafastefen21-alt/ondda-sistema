import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

const schema = z.object({
  companyName: z.string().min(2, "Nome da empresa obrigatório."),
  slug:        z.string()
    .min(2, "Slug muito curto.")
    .max(50, "Slug muito longo.")
    .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens."),
  name:     z.string().min(2, "Seu nome é obrigatório."),
  email:    z.string().email("Email inválido."),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres."),
  cnpj:     z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first.message }, { status: 400 });
  }

  const { companyName, slug, name, email, password, cnpj } = parsed.data;

  // Verifica duplicatas
  const [slugExists, emailExists] = await Promise.all([
    prisma.tenant.findUnique({ where: { slug } }),
    prisma.user.findUnique({ where: { email } }),
  ]);

  if (slugExists) {
    return NextResponse.json({ error: "Esse endereço de loja já está em uso." }, { status: 409 });
  }
  if (emailExists) {
    return NextResponse.json({ error: "Esse email já está cadastrado." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Cria tenant + admin em transação atômica
  const { user } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: companyName,
        slug,
        cnpj: cnpj || null,
        plan: "FREE",
      },
    });

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        name,
        email,
        password: passwordHash,
        role: "TENANT_ADMIN",
      },
    });

    return { tenant, user };
  });

  return NextResponse.json({ userId: user.id }, { status: 201 });
}
