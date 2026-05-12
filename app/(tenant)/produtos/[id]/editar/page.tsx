import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProdutoForm } from "../../produto-form";

export const dynamic = "force-dynamic";

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ⚠️ redirect() lança uma exceção internamente — não envolva em try/catch
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE"].includes(role)) redirect("/produtos");

  const { id } = await params;

  const [product, categoriesRaw] = await Promise.all([
    prisma.product.findFirst({ where: { id, tenantId } }),
    prisma.productCategory.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) redirect("/produtos");

  const categories = categoriesRaw.map((c) => ({ id: c.id, name: c.name }));

  const productData = {
    id:            product.id,
    name:          product.name,
    description:   product.description  ?? null,
    price:         Number(product.price),
    unit:          product.unit,
    minQuantity:   product.minQuantity  != null ? Number(product.minQuantity) : null,
    shelfLifeDays: product.shelfLifeDays ?? null,
    pricePacote:   product.pricePacote  != null ? Number(product.pricePacote) : null,
    priceCaixa:    product.priceCaixa   != null ? Number(product.priceCaixa)  : null,
    labelPacote:   product.labelPacote  ?? null,
    labelCaixa:    product.labelCaixa   ?? null,
    ncm:           product.ncm          ?? null,
    cfop:          product.cfop         ?? null,
    imageUrl:      product.imageUrl     ?? null,
    categoryId:    product.categoryId   ?? null,
    active:        product.active,
  };

  return (
    <ProdutoForm
      categories={categories}
      product={productData}
      mode="edit"
    />
  );
}
