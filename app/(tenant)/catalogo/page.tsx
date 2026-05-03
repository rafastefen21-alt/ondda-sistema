import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CatalogClient } from "./catalog-client";

export default async function CatalogPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId } = session.user;

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId, active: true },
      include: { category: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.productCategory.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <CatalogClient
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        unit: p.unit,
        minQuantity: p.minQuantity ? Number(p.minQuantity) : undefined,
        shelfLifeDays: p.shelfLifeDays ?? null,
        categoryId: p.categoryId,
        categoryName: p.category?.name,
        imageUrl: p.imageUrl,
      }))}
      categories={categories}
    />
  );
}
