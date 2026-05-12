"use client";

import { useState, useMemo } from "react";
import { Package, Pencil, Trash2, CheckSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  unit: string;
  price: number;
  active: boolean;
  imageUrl: string | null;
  categoryName: string | null;
};

type Category = {
  id: string;
  name: string;
};

const selectClass =
  "h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2";

export function ProdutosListClient({
  products,
  categories,
  canManage,
  canDelete,
}: {
  products: Product[];
  categories: Category[];
  canManage: boolean;
  canDelete: boolean;
}) {
  const [filterCategory, setFilterCategory] = useState("all");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  /* ── filtragem ── */
  const filtered = useMemo(() => {
    if (filterCategory === "all") return products;
    if (filterCategory === "__sem__") return products.filter((p) => !p.categoryName);
    return products.filter((p) => p.categoryName === filterCategory);
  }, [products, filterCategory]);

  /* ── agrupamento ── */
  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, Product[]>>((acc, p) => {
      const cat = p.categoryName ?? "Sem Categoria";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});
  }, [filtered]);

  /* ── seleção ── */
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(
      selected.size === filtered.length && filtered.length > 0
        ? new Set()
        : new Set(filtered.map((p) => p.id))
    );
  }

  function exitSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  /* ── bulk delete ── */
  async function handleBulkDelete() {
    if (selected.size === 0) return;
    const ok = confirm(
      `Apagar ${selected.size} produto${selected.size !== 1 ? "s" : ""} permanentemente? Esta ação não pode ser desfeita.`
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/produtos/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Erro ao apagar produtos.");
        return;
      }
      window.location.reload();
    } finally {
      setDeleting(false);
    }
  }

  const allSelected = selected.size === filtered.length && filtered.length > 0;

  return (
    <div className="space-y-4">
      {/* ── barra de filtro + seleção ── */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterCategory}
          onChange={(e) => {
            setFilterCategory(e.target.value);
            setSelected(new Set());
          }}
          className={selectClass}
        >
          <option value="all">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
          <option value="__sem__">Sem categoria</option>
        </select>

        {filterCategory !== "all" && (
          <span className="text-sm text-gray-500">{filtered.length} produto(s)</span>
        )}

        {canDelete && products.length > 0 && (
          <>
            {!selecting ? (
              <Button variant="outline" size="sm" onClick={() => setSelecting(true)}>
                <CheckSquare className="h-4 w-4" />
                Selecionar
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                  {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
                <Button variant="ghost" size="sm" onClick={exitSelecting}>
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── grid de produtos ── */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            {category}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((product) => {
              const isSelected = selected.has(product.id);
              return (
                <div
                  key={product.id}
                  className={selecting ? "cursor-pointer select-none" : ""}
                  onClick={selecting ? () => toggleSelect(product.id) : undefined}
                >
                  <Card
                    className={[
                      !product.active ? "opacity-60" : "",
                      selecting && isSelected
                        ? "ring-2 ring-blue-700 ring-offset-1"
                        : "",
                      "transition-shadow",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {/* Checkbox visual */}
                          {selecting && (
                            <div
                              className={[
                                "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors",
                                isSelected
                                  ? "border-blue-700 bg-blue-700"
                                  : "border-gray-300 bg-white",
                              ].join(" ")}
                            >
                              {isSelected && (
                                <svg
                                  className="h-3 w-3 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </div>
                          )}

                          {/* Thumbnail */}
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-blue-100 overflow-hidden">
                            {product.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="h-10 w-10 object-cover rounded-md"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-blue-800" />
                            )}
                          </div>

                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-400">por {product.unit}</p>
                          </div>
                        </div>

                        {/* Botão editar — oculto no modo seleção */}
                        {!selecting && canManage && (
                          // eslint-disable-next-line @next/next/no-html-link-for-pages
                          <a
                            href={`/produtos/${product.id}/editar`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-lg font-semibold text-gray-900">
                          {formatCurrency(product.price)}
                        </span>
                        <Badge variant={product.active ? "success" : "secondary"}>
                          {product.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Vazio */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-16">
          <Package className="mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">
            {filterCategory !== "all"
              ? "Nenhum produto nesta categoria."
              : "Nenhum produto cadastrado."}
          </p>
        </div>
      )}

      {/* ── barra flutuante de ação em massa ── */}
      {selecting && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-3 rounded-2xl bg-gray-900 px-5 py-3 shadow-2xl ring-1 ring-white/10">
            <span className="text-sm font-medium text-white">
              {selected.size} selecionado{selected.size !== 1 ? "s" : ""}
            </span>
            <div className="h-4 w-px bg-white/20" />
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Apagando..." : "Apagar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
