import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { CategoriasManager } from "./categorias-manager";
import { ProdutosBulkClient } from "./produtos-bulk-client";

export default async function ProdutosPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  const canManage = ["TENANT_ADMIN", "GERENTE"].includes(role);

  const [products, categories] = await Promise.all([
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

  // Group by category
  const grouped = products.reduce<
    Record<string, typeof products>
  >((acc, p) => {
    const cat = p.category?.name ?? "Sem Categoria";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

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

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            {category}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((product) => (
              <Card key={product.id} className={!product.active ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-blue-100 overflow-hidden">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.imageUrl} alt={product.name} className="h-10 w-10 object-cover rounded-md" />
                        ) : (
                          <Package className="h-5 w-5 text-blue-800" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-400">
                          por {product.unit}
                        </p>
                      </div>
                    </div>
                    {canManage && (
                      /* Navegação forçada (MPA) — evita crash no segment-cache do Next.js 16
                         ao navegar para rota dinâmica aninhada via RSC client navigation */
                      // eslint-disable-next-line @next/next/no-html-link-for-pages
                      <a href={`/produtos/${product.id}/editar`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-semibold text-gray-900">
                      {formatCurrency(Number(product.price))}
                    </span>
                    <Badge variant={product.active ? "success" : "secondary"}>
                      {product.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {products.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-16">
          <Package className="mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">Nenhum produto cadastrado.</p>
          {canManage && (
            <Link href="/produtos/novo" className="mt-3">
              <Button variant="outline">Cadastrar primeiro produto</Button>
            </Link>
          )}
        </div>
      )}

      {canManage && (
        <CategoriasManager initial={categories} />
      )}
    </div>
  );
}
