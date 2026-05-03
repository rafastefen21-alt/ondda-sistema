import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...");

  // Create tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "casa-do-pao" },
    update: {},
    create: {
      name: "Distribuidora Casa do Pão",
      slug: "casa-do-pao",
      cnpj: "12.345.678/0001-90",
      email: "contato@casadopao.com.br",
      phone: "(11) 99999-0000",
      city: "São Paulo",
      state: "SP",
      plan: "PRO",
    },
  });
  console.log("✅ Tenant criado:", tenant.name);

  const passwordHash = await bcrypt.hash("senha123", 10);

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: "admin@casadopao.com.br" },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Administrador",
      email: "admin@casadopao.com.br",
      password: passwordHash,
      role: "TENANT_ADMIN",
    },
  });

  // Create gerente
  const gerente = await prisma.user.upsert({
    where: { email: "gerente@casadopao.com.br" },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Maria Gerente",
      email: "gerente@casadopao.com.br",
      password: passwordHash,
      role: "GERENTE",
    },
  });

  // Create operador
  const operador = await prisma.user.upsert({
    where: { email: "operador@casadopao.com.br" },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "João Operador",
      email: "operador@casadopao.com.br",
      password: passwordHash,
      role: "OPERADOR",
    },
  });

  // Create clients
  const cliente1 = await prisma.user.upsert({
    where: { email: "padaria.esperanca@gmail.com" },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Padaria Esperança",
      email: "padaria.esperanca@gmail.com",
      password: passwordHash,
      role: "CLIENTE",
    },
  });

  const cliente2 = await prisma.user.upsert({
    where: { email: "mercadinho.bom@gmail.com" },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Mercadinho Bom Preço",
      email: "mercadinho.bom@gmail.com",
      password: passwordHash,
      role: "CLIENTE",
    },
  });

  console.log("✅ Usuários criados:", [admin, gerente, operador, cliente1, cliente2].map(u => u.email).join(", "));

  // Create categories
  const catPaes = await prisma.productCategory.upsert({
    where: { id: "cat-paes" },
    update: {},
    create: {
      id: "cat-paes",
      tenantId: tenant.id,
      name: "Pães",
    },
  });

  const catDoces = await prisma.productCategory.upsert({
    where: { id: "cat-doces" },
    update: {},
    create: {
      id: "cat-doces",
      tenantId: tenant.id,
      name: "Doces e Bolos",
    },
  });

  const catSalgados = await prisma.productCategory.upsert({
    where: { id: "cat-salgados" },
    update: {},
    create: {
      id: "cat-salgados",
      tenantId: tenant.id,
      name: "Salgados",
    },
  });

  // Create products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { id: "prod-pao-frances" },
      update: {},
      create: {
        id: "prod-pao-frances",
        tenantId: tenant.id,
        categoryId: catPaes.id,
        name: "Pão Francês",
        description: "Pão francês crocante, assado na hora",
        price: 0.85,
        unit: "un",
        minQuantity: 50,
      },
    }),
    prisma.product.upsert({
      where: { id: "prod-pao-forma" },
      update: {},
      create: {
        id: "prod-pao-forma",
        tenantId: tenant.id,
        categoryId: catPaes.id,
        name: "Pão de Forma",
        description: "Pão de forma fatiado 500g",
        price: 7.50,
        unit: "un",
        minQuantity: 10,
      },
    }),
    prisma.product.upsert({
      where: { id: "prod-bolo-chocolate" },
      update: {},
      create: {
        id: "prod-bolo-chocolate",
        tenantId: tenant.id,
        categoryId: catDoces.id,
        name: "Bolo de Chocolate",
        description: "Bolo de chocolate fofinho 1kg",
        price: 45.00,
        unit: "un",
        minQuantity: 1,
      },
    }),
    prisma.product.upsert({
      where: { id: "prod-coxinha" },
      update: {},
      create: {
        id: "prod-coxinha",
        tenantId: tenant.id,
        categoryId: catSalgados.id,
        name: "Coxinha",
        description: "Coxinha de frango, 80g cada",
        price: 3.50,
        unit: "un",
        minQuantity: 20,
      },
    }),
    prisma.product.upsert({
      where: { id: "prod-pao-queijo" },
      update: {},
      create: {
        id: "prod-pao-queijo",
        tenantId: tenant.id,
        categoryId: catPaes.id,
        name: "Pão de Queijo",
        description: "Pão de queijo mineiro, 50g cada",
        price: 2.80,
        unit: "un",
        minQuantity: 30,
      },
    }),
  ]);

  console.log("✅ Produtos criados:", products.map(p => p.name).join(", "));

  // Create sample orders
  const order1 = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      clientId: cliente1.id,
      status: "PENDENTE_APROVACAO",
      notes: "Entrega preferencialmente pela manhã",
      requestedDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          { productId: "prod-pao-frances", quantity: 200, unitPrice: 0.85 },
          { productId: "prod-pao-queijo", quantity: 60, unitPrice: 2.80 },
        ],
      },
    },
  });

  const order2 = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      clientId: cliente2.id,
      status: "APROVADO",
      approvedAt: new Date(),
      approvedById: admin.id,
      requestedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          { productId: "prod-pao-forma", quantity: 30, unitPrice: 7.50 },
          { productId: "prod-coxinha", quantity: 100, unitPrice: 3.50 },
          { productId: "prod-bolo-chocolate", quantity: 5, unitPrice: 45.00 },
        ],
      },
    },
  });

  const order3 = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      clientId: cliente1.id,
      status: "EM_PRODUCAO",
      approvedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      approvedById: admin.id,
      requestedDate: new Date(),
      items: {
        create: [
          { productId: "prod-pao-frances", quantity: 500, unitPrice: 0.85 },
          { productId: "prod-bolo-chocolate", quantity: 10, unitPrice: 45.00 },
        ],
      },
    },
  });

  // Add payments to order2
  await prisma.payment.create({
    data: {
      tenantId: tenant.id,
      orderId: order2.id,
      amount: 835.00,
      method: "PIX",
      installments: 1,
      installmentN: 1,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "PENDENTE",
    },
  });

  // Add operational costs
  await prisma.operationalCost.createMany({
    data: [
      {
        tenantId: tenant.id,
        description: "Farinha de trigo - Fornecedor ABC",
        amount: 2500.00,
        category: "MATERIA_PRIMA",
        date: new Date(),
      },
      {
        tenantId: tenant.id,
        description: "Energia elétrica",
        amount: 850.00,
        category: "ENERGIA",
        date: new Date(),
        recurring: true,
      },
      {
        tenantId: tenant.id,
        description: "Aluguel da cozinha",
        amount: 3200.00,
        category: "ALUGUEL",
        date: new Date(),
        recurring: true,
      },
    ],
  });

  console.log("✅ Pedidos e dados financeiros criados");
  console.log("\n📋 CREDENCIAIS DE ACESSO:");
  console.log("================================");
  console.log("🔐 Admin:    admin@casadopao.com.br / senha123");
  console.log("🔐 Gerente:  gerente@casadopao.com.br / senha123");
  console.log("🔐 Operador: operador@casadopao.com.br / senha123");
  console.log("🔐 Cliente 1: padaria.esperanca@gmail.com / senha123");
  console.log("🔐 Cliente 2: mercadinho.bom@gmail.com / senha123");
  console.log("================================\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
