import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/loja/[slug]/login
 *
 * Autentica um cliente da loja virtual.
 * Retorna { id, name, email, active } para uso no cliente.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug, active: true },
    select: { id: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 });
  }

  const body   = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const emailNorm = parsed.data.email.toLowerCase().trim();

  const user = await prisma.user.findFirst({
    where: { email: emailNorm, tenantId: tenant.id, role: "CLIENTE" },
    select: { id: true, name: true, email: true, password: true, active: true },
  });

  if (!user || !user.password) {
    return NextResponse.json({ error: "Email ou senha inválidos." }, { status: 401 });
  }

  const valid = await bcrypt.compare(parsed.data.password, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Email ou senha inválidos." }, { status: 401 });
  }

  // Busca preços personalizados do cliente
  const customPrices = await prisma.clientProductPrice.findMany({
    where: { clientId: user.id, tenantId: tenant.id },
    select: { productId: true, price: true, pricePacote: true, priceCaixa: true },
  });

  return NextResponse.json({
    id:     user.id,
    name:   user.name,
    email:  user.email,
    active: user.active,
    customPrices: customPrices.map((c) => ({
      productId:   c.productId,
      price:       c.price       ? Number(c.price)       : null,
      pricePacote: c.pricePacote ? Number(c.pricePacote) : null,
      priceCaixa:  c.priceCaixa  ? Number(c.priceCaixa)  : null,
    })),
  });
}
