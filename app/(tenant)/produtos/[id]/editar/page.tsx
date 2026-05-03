import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { ProdutoForm } from "../../produto-form";

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE"].includes(role)) redirect("/produtos");

  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findFirst({
      where: { id, tenantId },
    }),
    prisma.productCategory.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!product) notFound();

  return (
    <ProdutoForm
      categories={categories}
      product={{
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        unit: product.unit,
        minQuantity: product.minQuantity ? Number(product.minQuantity) : null,
        shelfLifeDays: product.shelfLifeDays ?? null,
        categoryId: product.categoryId,
        active: product.active,
      }}
      mode="edit"
    />
  );
}
