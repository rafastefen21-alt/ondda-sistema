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
  type:        z.literal("novo"),
  name:        z.string().min(1),
  email:       z.string().email(),
  password:    z.string().min(6),
  phone:       z.string().optional(),
  cnpj:        z.string().optional(),
  notes:       z.string().optional(),
  // Endereço
  cep:         z.string().optional(),
  logradouro:  z.string().optional(),
  numero:      z.string().optional(),
  complemento: z.string().optional(),
  bairro:      z.string().optional(),
  city:        z.string().optional(),
  state:       z.string().optional(),
  // Itens opcionais: cliente pode só se cadastrar sem fazer pedido
  items: z.array(itemSchema).default([]),
});

const PAYMENT_METHODS = ["PIX", "BOLETO", "CARTAO_CREDITO", "DINHEIRO", "TRANSFERENCIA"] as const;

const existenteSchema = z.object({
  type: z.literal("existente"),
  email: z.string().email(),
  password: z.string().min(1),
  notes: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
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

  // Se não há itens no carrinho (cadastro sem pedido), pular validação de produtos
  if (data.items.length === 0 && data.type === "existente") {
    return NextResponse.json({ error: "Selecione ao menos um produto." }, { status: 400 });
  }

  // Validate all products belong to this tenant
  const productIds = data.items.map((i) => i.productId);
  const products = data.items.length === 0 ? [] : await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId: tenant.id, active: true },
    select: {
      id: true, price: true, pricePacote: true, priceCaixa: true,
      labelPacote: true, labelCaixa: true, unit: true,
    },
  });

  if (productIds.length > 0 && products.length !== productIds.length) {
    return NextResponse.json({ error: "Produto inválido no carrinho." }, { status: 400 });
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  let clientId: string;

  if (data.type === "novo") {
    const emailNorm = data.email.toLowerCase().trim();
    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) {
      return NextResponse.json(
        { error: "Email já cadastrado. Use a opção 'Já tenho conta'." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const newUser = await prisma.user.create({
      data: {
        tenantId:    tenant.id,
        name:        data.name,
        email:       emailNorm,
        password:    passwordHash,
        phone:       data.phone       || null,
        cnpj:        data.cnpj        || null,
        cep:         data.cep         || null,
        logradouro:  data.logradouro  || null,
        numero:      data.numero      || null,
        complemento: data.complemento || null,
        bairro:      data.bairro      || null,
        city:        data.city        || null,
        state:       data.state       || null,
        role:   "CLIENTE",
        active: false, // pendente de aprovação pelo admin
      },
    });
    clientId = newUser.id;

    // Cadastro sem itens: só criou a conta, sem pedido
    if (data.items.length === 0) {
      return NextResponse.json({ orderId: null }, { status: 201 });
    }
  } else {
    // Existing user — verify credentials
    const user = await prisma.user.findFirst({
      where: { email: data.email.toLowerCase().trim(), tenantId: tenant.id, role: "CLIENTE" },
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

  // Busca preços personalizados do cliente (se existirem)
  const customPriceRows = await prisma.clientProductPrice.findMany({
    where: { clientId, tenantId: tenant.id },
    select: { productId: true, price: true, pricePacote: true, priceCaixa: true },
  });
  const customPriceMap = new Map(customPriceRows.map((c) => [c.productId, c]));

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
      paymentMethod: data.type === "existente" ? (data.paymentMethod ?? null) : null,
      items: {
        create: data.items.map((item) => {
          const p      = productMap.get(item.productId)!;
          const custom = customPriceMap.get(item.productId);

          // Preço: customizado → padrão do produto (por tier)
          let unitPrice = custom?.price       ?? p.price;
          if (item.tier === "pacote") unitPrice = custom?.pricePacote ?? p.pricePacote ?? unitPrice;
          if (item.tier === "caixa")  unitPrice = custom?.priceCaixa  ?? p.priceCaixa  ?? unitPrice;

          // Tier label salvo em notes para exibição no pedido
          let tierLabel: string | null = null;
          if (item.tier === "caixa"  && p.labelCaixa)  tierLabel = p.labelCaixa;
          if (item.tier === "pacote" && p.labelPacote)  tierLabel = p.labelPacote;

          return {
            productId: item.productId,
            quantity:  item.quantity,
            unitPrice,
            notes: tierLabel,
          };
        }),
      },
    },
  });

  return NextResponse.json({ orderId: order.id }, { status: 201 });
}
