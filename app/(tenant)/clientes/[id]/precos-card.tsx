"use client";

import { useState } from "react";
import { Tag, Check, Loader2, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProductRow {
  id:          string;
  name:        string;
  price:       number;        // preço padrão unitário
  pricePacote: number | null;
  labelPacote: string | null;
  priceCaixa:  number | null;
  labelCaixa:  string | null;
}

interface CustomPrice {
  productId:   string;
  price:       number | null;
  pricePacote: number | null;
  priceCaixa:  number | null;
}

interface Props {
  clientId:      string;
  products:      ProductRow[];
  initialPrices: CustomPrice[];
}

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PrecosCard({ clientId, products, initialPrices }: Props) {
  // Mapa produtoId → preços customizados (string para os inputs)
  const toStr = (v: number | null) => (v !== null && v !== undefined ? String(v) : "");

  const [prices, setPrices] = useState<Record<string, { price: string; pricePacote: string; priceCaixa: string }>>(
    () => {
      const map: Record<string, { price: string; pricePacote: string; priceCaixa: string }> = {};
      products.forEach((p) => {
        const custom = initialPrices.find((c) => c.productId === p.id);
        map[p.id] = {
          price:       toStr(custom?.price       ?? null),
          pricePacote: toStr(custom?.pricePacote ?? null),
          priceCaixa:  toStr(custom?.priceCaixa  ?? null),
        };
      });
      return map;
    },
  );

  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);
  const [error,  setError]    = useState("");

  function setField(productId: string, field: "price" | "pricePacote" | "priceCaixa", value: string) {
    // Aceita apenas números e ponto/vírgula
    const clean = value.replace(",", ".").replace(/[^\d.]/g, "");
    setPrices((prev) => ({ ...prev, [productId]: { ...prev[productId], [field]: clean } }));
  }

  function reset(productId: string) {
    setPrices((prev) => ({
      ...prev,
      [productId]: { price: "", pricePacote: "", priceCaixa: "" },
    }));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = products.map((p) => ({
        productId:   p.id,
        price:       prices[p.id]?.price       ? parseFloat(prices[p.id].price)       : null,
        pricePacote: prices[p.id]?.pricePacote ? parseFloat(prices[p.id].pricePacote) : null,
        priceCaixa:  prices[p.id]?.priceCaixa  ? parseFloat(prices[p.id].priceCaixa)  : null,
      }));

      const res = await fetch(`/api/clientes/${clientId}/precos`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erro ao salvar.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  const hasAnyCustom = products.some((p) => {
    const v = prices[p.id];
    return v?.price || v?.pricePacote || v?.priceCaixa;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="h-4 w-4 text-blue-600" />
          Preços Personalizados
        </CardTitle>
        <p className="text-xs text-gray-400">
          Deixe o campo em branco para usar o preço padrão do produto.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Cabeçalho da tabela */}
        <div className="hidden grid-cols-[1fr_100px_100px_100px_28px] gap-2 px-1 sm:grid">
          <p className="text-xs font-semibold text-gray-400">Produto</p>
          <p className="text-xs font-semibold text-gray-400 text-right">Unidade</p>
          <p className="text-xs font-semibold text-gray-400 text-right">Pacote</p>
          <p className="text-xs font-semibold text-gray-400 text-right">Caixa</p>
          <span />
        </div>

        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {products.map((p) => {
            const v = prices[p.id] ?? { price: "", pricePacote: "", priceCaixa: "" };
            const hasCustom = v.price || v.pricePacote || v.priceCaixa;

            return (
              <div
                key={p.id}
                className={`rounded-xl border p-3 transition-colors ${
                  hasCustom ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-gray-50"
                }`}
              >
                {/* Nome */}
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  {hasCustom && (
                    <button
                      onClick={() => reset(p.id)}
                      title="Remover preço personalizado"
                      className="rounded p-0.5 text-gray-400 hover:text-red-500"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Campos de preço */}
                <div className="grid gap-2 sm:grid-cols-3">
                  {/* Unidade */}
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-gray-500">
                      Unidade <span className="text-gray-300">({fmtBRL(p.price)})</span>
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={v.price}
                        onChange={(e) => setField(p.id, "price", e.target.value)}
                        placeholder={String(p.price)}
                        className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                  </div>

                  {/* Pacote */}
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-gray-500">
                      {p.labelPacote ?? "Pacote"}{" "}
                      {p.pricePacote !== null && (
                        <span className="text-gray-300">({fmtBRL(p.pricePacote)})</span>
                      )}
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={v.pricePacote}
                        onChange={(e) => setField(p.id, "pricePacote", e.target.value)}
                        placeholder={p.pricePacote !== null ? String(p.pricePacote) : "—"}
                        disabled={p.pricePacote === null}
                        className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-300"
                      />
                    </div>
                  </div>

                  {/* Caixa */}
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-gray-500">
                      {p.labelCaixa ?? "Caixa"}{" "}
                      {p.priceCaixa !== null && (
                        <span className="text-gray-300">({fmtBRL(p.priceCaixa)})</span>
                      )}
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={v.priceCaixa}
                        onChange={(e) => setField(p.id, "priceCaixa", e.target.value)}
                        placeholder={p.priceCaixa !== null ? String(p.priceCaixa) : "—"}
                        disabled={p.priceCaixa === null}
                        className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-300"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-1">
          {hasAnyCustom ? (
            <p className="text-xs text-blue-700 font-medium">
              Preços personalizados ativos para este cliente.
            </p>
          ) : (
            <p className="text-xs text-gray-400">Nenhum preço personalizado definido.</p>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Tag className="h-4 w-4" />
            )}
            {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar preços"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
