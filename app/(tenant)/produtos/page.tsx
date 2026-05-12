import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoriasManager } from "./categorias-manager";
import { ProdutosBulkClient } from "./produtos-bulk-client";
import { ProdutosListClient } from "./produtos-list-client";

export default async function ProdutosPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  const canManage = ["TENANT_ADMIN", "GERENTE"].includes(role);
  const canDelete = role === "TENANT_ADMIN";

  const [productsRaw, categories] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId },
      include: { category: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.productCategory.findMany({
      where: { tenantId },
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  // Serializa para JSON puro (sem tipos Decimal/Prisma)
  const products = productsRaw.map((p) => ({
    id:           p.id,
    name:         p.name,
    unit:         p.unit,
    price:        Number(p.price),
    active:       p.active,
    imageUrl:     p.imageUrl ?? null,
    categoryName: p.category?.name ?? null,
  }));

  const categoriesSimple = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
          <p className="text-gray-500">{products.length} produto(s) cadastrado(s)</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <ProdutosBulkClient />
            <Link href="/produtos/novo">
              <Button>
                <Plus className="h-4 w-4" />
                Novo Produto
              </Button>
            </Link>
          </div>
        )}
      </div>

      <ProdutosListClient
        products={products}
        categories={categoriesSimple}
        canManage={canManage}
        canDelete={canDelete}
      />

      {canManage && (
        <CategoriasManager initial={categories} />
      )}
    </div>
  );
}
