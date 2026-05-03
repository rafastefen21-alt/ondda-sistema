"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const selectClass =
  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type Category = { id: string; name: string };

type ProductData = {
  id?: string;
  name?: string;
  description?: string | null;
  price?: number | string;
  unit?: string;
  minQuantity?: number | string | null;
  shelfLifeDays?: number | null;
  ncm?: string | null;
  cfop?: string | null;
  imageUrl?: string | null;
  categoryId?: string | null;
  active?: boolean;
};

export function ProdutoForm({
  categories,
  product,
  mode,
}: {
  categories: Category[];
  product?: ProductData;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setUploading(true);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setUploadError(json.error ?? "Erro ao fazer upload.");
      return;
    }

    const { url } = await res.json();
    setImageUrl(url);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name") as string,
      description: (fd.get("description") as string) || undefined,
      price: parseFloat(fd.get("price") as string),
      unit: fd.get("unit") as string,
      categoryId: (fd.get("categoryId") as string) || undefined,
      minQuantity: fd.get("minQuantity")
        ? parseFloat(fd.get("minQuantity") as string)
        : undefined,
      shelfLifeDays: fd.get("shelfLifeDays")
        ? parseInt(fd.get("shelfLifeDays") as string, 10)
        : undefined,
      ncm:  (fd.get("ncm")  as string) || undefined,
      cfop: (fd.get("cfop") as string) || undefined,
      imageUrl: imageUrl || undefined,
      active: fd.get("active") === "true",
    };

    const url =
      mode === "create" ? "/api/produtos" : `/api/produtos/${product!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erro ao salvar produto.");
      return;
    }

    router.push("/produtos");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/produtos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === "create" ? "Novo Produto" : "Editar Produto"}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do produto</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome do produto *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={product?.name}
                placeholder="Ex: Pão Francês"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={product?.description ?? ""}
                placeholder="Descrição opcional do produto"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="price">Preço (R$) *</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={product?.price ? Number(product.price).toFixed(2) : ""}
                  placeholder="0,00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit">Unidade *</Label>
                <Input
                  id="unit"
                  name="unit"
                  defaultValue={product?.unit ?? "un"}
                  placeholder="un, kg, cx, pct"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="minQuantity">Qtd. mínima do pedido</Label>
                <Input
                  id="minQuantity"
                  name="minQuantity"
                  type="number"
                  step="1"
                  min="1"
                  defaultValue={
                    product?.minQuantity ? Number(product.minQuantity) : ""
                  }
                  placeholder="Ex: 50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shelfLifeDays">Shelf life (dias)</Label>
                <Input
                  id="shelfLifeDays"
                  name="shelfLifeDays"
                  type="number"
                  step="1"
                  min="1"
                  defaultValue={product?.shelfLifeDays ?? ""}
                  placeholder="Ex: 7"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ncm">
                  NCM{" "}
                  <span className="font-normal text-gray-400">(NF-e)</span>
                </Label>
                <Input
                  id="ncm"
                  name="ncm"
                  defaultValue={product?.ncm ?? ""}
                  placeholder="Ex: 19059090"
                  maxLength={10}
                />
                <p className="text-xs text-gray-400">
                  8 dígitos —{" "}
                  <a
                    href="https://www.tabela-ncm.com.br"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-800 underline"
                  >
                    tabela-ncm.com.br
                  </a>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cfop">
                  CFOP{" "}
                  <span className="font-normal text-gray-400">(NF-e)</span>
                </Label>
                <Input
                  id="cfop"
                  name="cfop"
                  defaultValue={product?.cfop ?? "5102"}
                  placeholder="5102"
                  maxLength={5}
                />
                <p className="text-xs text-gray-400">
                  5102 = int. · 6102 = interestad.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Foto do produto</Label>

              {/* Preview */}
              {imageUrl ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="h-28 w-28 rounded-lg border border-gray-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => { setImageUrl(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                    title="Remover foto"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
                  <ImageIcon className="h-8 w-8 text-gray-300" />
                </div>
              )}

              {/* Upload button */}
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-fit"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? "Enviando..." : "Selecionar arquivo"}
                </Button>
                <p className="text-xs text-gray-400">
                  JPG, PNG, WEBP ou GIF · máx. 5 MB
                </p>
              </div>

              {/* URL manual fallback */}
              <details className="group">
                <summary className="cursor-pointer text-xs text-blue-800 hover:underline list-none">
                  Ou cole uma URL de imagem
                </summary>
                <Input
                  className="mt-1.5"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                />
              </details>

              {uploadError && (
                <p className="text-xs text-red-500">{uploadError}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="categoryId">Categoria</Label>
              <select
                id="categoryId"
                name="categoryId"
                defaultValue={product?.categoryId ?? ""}
                className={selectClass}
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {mode === "edit" && (
              <div className="space-y-1.5">
                <Label htmlFor="active">Status</Label>
                <select
                  id="active"
                  name="active"
                  defaultValue={product?.active !== false ? "true" : "false"}
                  className={selectClass}
                >
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Link href="/produtos" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading
                  ? "Salvando..."
                  : mode === "create"
                  ? "Criar Produto"
                  : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
