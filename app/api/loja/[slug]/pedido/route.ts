import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const itemSchema = z.object({
  productId: z.string(),
  quantity: z.number().positive(),
  tier: z.enum(["unidade", "pacote", "caixa"]).optional().default("unidade"),
});

const novoSchema = z.object({
  type: z.literal("novo"),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  cnpj: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

const existenteSchema = z.object({
  type: z.literal("existente"),
  email: z.string().email(),
  password: z.string().min(1),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

const bodySchema = z.discriminatedUnion("type", [novoSchema, existenteSchema]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Find tenant by slug
  const tenant = await prisma.tenant.findUnique({
    where: { slug, active: true },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Distribuidora não encontrada." }, { status: 404 });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const data = parsed.data;

  // Validate all products belong to this tenant
  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId: tenant.id, active: true },
  });

  if (products.length !== productIds.length) {
    return NextResponse.json({ error: "Produto inválido no carrinho." }, { status: 400 });
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  let clientId: string;

  if (data.type === "novo") {
    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email já cadastrado. Use a opção 'Já tenho conta'." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const newUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: data.name,
        email: data.email,
        password: passwordHash,
        role: "CLIENTE",
      },
    });
    clientId = newUser.id;
  } else {
    // Existing user — verify credentials
    const user = await prisma.user.findFirst({
      where: { email: data.email, tenantId: tenant.id, role: "CLIENTE" },
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: "Email ou senha inválidos." }, { status: 401 });
    }

    const match = await bcrypt.compare(data.password, user.password);
    if (!match) {
      return NextResponse.json({ error: "Email ou senha inválidos." }, { status: 401 });
    }

    clientId = user.id;
  }

  // Build notes (append CNPJ if provided)
  const cnpjLine = data.type === "novo" && data.cnpj ? `CNPJ: ${data.cnpj}` : null;
  const notesText = [cnpjLine, data.notes].filter(Boolean).join("\n") || null;

  // Create the order
  const order = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      clientId,
      status: "PENDENTE_APROVACAO",
      notes: notesText,
      items: {
        create: data.items.map((item) => {
          const p = productMap.get(item.productId)!;
          let unitPrice = p.price;
          if (item.tier === "pacote" && p.pricePacote) unitPrice = p.pricePacote;
          if (item.tier === "caixa"  && p.priceCaixa)  unitPrice = p.priceCaixa;
          return {
            productId: item.productId,
            quantity: item.quantity,
            unitPrice,
          };
        }),
      },
    },
  });

  return NextResponse.json({ orderId: order.id }, { status: 201 });
}
