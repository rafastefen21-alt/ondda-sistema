import { PrismaClient } from "../app/generated/prisma/client/index.js";

const prisma = new PrismaClient();

const result = await prisma.product.updateMany({
  where: { cfop: "5401" },
  data:  { cfop: "5405" },
});

console.log("Produtos atualizados de 5401 → 5405:", result.count);
await prisma.$disconnect();
