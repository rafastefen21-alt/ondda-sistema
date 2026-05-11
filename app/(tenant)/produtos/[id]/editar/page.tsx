import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProdutoForm } from "../../produto-form";

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error("[EditarProduto] auth() falhou:", err);
    redirect("/login");
  }

  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE"].includes(role)) redirect("/produtos");

  const { id } = await params;

  let product;
  let categoriesRaw: { id: string; name: string }[] = [];

  try {
    const [prod, cats] = await Promise.all([
      prisma.product.findFirst({ where: { id, tenantId } }),
      prisma.productCategory.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);
    product = prod;
    categoriesRaw = cats;
  } catch (err) {
    console.error("[EditarProduto] prisma falhou:", err);
    redirect("/produtos");
  }

  // Produto não encontrado → volta para lista (evita notFound() no RSC)
  if (!product) redirect("/produtos");

  // Garante objetos JSON puros para o RSC payload (sem tipos Prisma/Decimal)
  const categories = categoriesRaw.map((c) => ({ id: c.id, name: c.name }));

  const productData = {
    id:           product.id,
    name:         product.name,
    description:  product.description ?? null,
    price:        Number(product.price),
    unit:         product.unit,
    minQuantity:  product.minQuantity != null ? Number(product.minQuantity) : null,
    shelfLifeDays: product.shelfLifeDays ?? null,
    pricePacote:  product.pricePacote != null ? Number(product.pricePacote) : null,
    priceCaixa:   product.priceCaixa  != null ? Number(product.priceCaixa)  : null,
    labelPacote:  product.labelPacote  ?? null,
    labelCaixa:   product.labelCaixa   ?? null,
    ncm:          product.ncm           ?? null,
    cfop:         product.cfop          ?? null,
    imageUrl:     product.imageUrl      ?? null,
    categoryId:   product.categoryId    ?? null,
    active:       product.active,
  };

  return (
    <ProdutoForm
      categories={categories}
      product={productData}
      mode="edit"
    />
  );
}
