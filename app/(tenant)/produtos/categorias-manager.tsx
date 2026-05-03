"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Category {
  id: string;
  name: string;
  _count: { products: number };
}

export function CategoriasManager({ initial }: { initial: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(initial);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    setError("");

    const res = await fetch("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });

    setAdding(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erro ao criar categoria.");
      return;
    }

    const cat = await res.json();
    setCategories((prev) => [...prev, cat]);
    setNewName("");
  }

  async function handleDelete(id: string) {
    setError("");
    const res = await fetch(`/api/categorias/${id}`, { method: "DELETE" });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erro ao excluir.");
      return;
    }

    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return;
    setError("");

    const res = await fetch(`/api/categorias/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erro ao renomear.");
      return;
    }

    const updated = await res.json();
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    setEditingId(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="h-4 w-4 text-blue-700" />
          Categorias de Produtos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add new */}
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome da nova categoria..."
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={adding || !newName.trim()} size="sm">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {/* List */}
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {categories.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">
              Nenhuma categoria criada.
            </p>
          )}
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-3 px-3 py-2.5">
              {editingId === cat.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename(cat.id)}
                    className="h-8 flex-1"
                    autoFocus
                  />
                  <button
                    onClick={() => handleRename(cat.id)}
                    className="rounded p-1 text-green-600 hover:bg-green-50"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-gray-900">
                    {cat.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {cat._count.products} produto(s)
                  </span>
                  <button
                    onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Renomear"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    disabled={cat._count.products > 0}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                    title={
                      cat._count.products > 0
                        ? "Remova os produtos antes de excluir"
                        : "Excluir categoria"
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">
          Só é possível excluir categorias sem produtos vinculados.
        </p>
      </CardContent>
    </Card>
  );
}
