import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { LojaClient } from "./loja-client";

export default async function LojaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug, active: true },
    select: {
      id: true, name: true, slug: true,
      lojaCorPrimaria: true, lojaBannerUrl: true,
      lojaLogoUrl: true, lojaDescricao: true,
    },
  });

  if (!tenant) notFound();

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId: tenant.id, active: true },
      include: { category: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.productCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <LojaClient
      tenant={{
        name: tenant.name,
        slug: tenant.slug,
        corPrimaria: tenant.lojaCorPrimaria ?? "#f59e0b",
        bannerUrl: tenant.lojaBannerUrl ?? null,
        logoUrl: tenant.lojaLogoUrl ?? null,
        descricao: tenant.lojaDescricao ?? null,
      }}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        unit: p.unit,
        minQuantity: p.minQuantity ? Number(p.minQuantity) : undefined,
        shelfLifeDays: p.shelfLifeDays ?? null,
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        imageUrl: p.imageUrl ?? null,
      }))}
      categories={categories}
    />
  );
}
