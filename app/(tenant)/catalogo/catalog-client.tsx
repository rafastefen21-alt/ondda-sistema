"use client";

import { useState } from "react";
import { ShoppingCart, Plus, Minus, Package, Search, Send, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, PAYMENT_METHOD_LABELS } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  minQuantity?: number;
  shelfLifeDays?: number | null;
  categoryId: string | null;
  categoryName?: string;
  imageUrl: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface CatalogClientProps {
  products: Product[];
  categories: Category[];
}

export function CatalogClient({ products, categories }: CatalogClientProps) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);

  const filtered = products.filter((p) => {
    const matchSearch =
      !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !selectedCategory || p.categoryId === selectedCategory;
    return matchSearch && matchCat;
  });

  const cartItems = Object.values(cart);
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev[product.id];
      return {
        ...prev,
        [product.id]: {
          product,
          quantity: existing
            ? existing.quantity + (product.minQuantity ?? 1)
            : product.minQuantity ?? 1,
        },
      };
    });
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    } else {
      setCart((prev) => ({
        ...prev,
        [productId]: { ...prev[productId], quantity: qty },
      }));
    }
  }

  async function submitOrder() {
    if (cartItems.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            unitPrice: item.product.price,
          })),
          notes,
          paymentMethod: paymentMethod || undefined,
        }),
      });
      if (!res.ok) throw new Error("Erro ao criar pedido");
      const order = await res.json();
      router.push(`/pedidos/${order.id}`);
    } catch {
      alert("Erro ao enviar pedido. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de Produtos</h1>
          <p className="text-gray-500">Selecione os produtos para seu pedido</p>
        </div>
        {cartCount > 0 && (
          <button
            onClick={() => setShowCart(!showCart)}
            className="relative flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-100"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>{cartCount} iten(s)</span>
            <span className="font-bold">{formatCurrency(cartTotal)}</span>
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-800 text-xs text-white">
              {cartItems.length}
            </span>
          </button>
        )}
      </div>

      {/* Cart panel */}
      {showCart && cartItems.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <h2 className="mb-3 font-semibold text-amber-900">Seu Pedido</h2>
            <div className="space-y-2">
              {cartItems.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-gray-700">{item.product.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        updateQty(
                          item.product.id,
                          item.quantity - (item.product.minQuantity ?? 1)
                        )
                      }
                      className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-12 text-center text-sm font-medium">
                      {item.quantity} {item.product.unit}
                    </span>
                    <button
                      onClick={() =>
                        updateQty(
                          item.product.id,
                          item.quantity + (item.product.minQuantity ?? 1)
                        )
                      }
                      className="flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <span className="w-20 text-right text-sm font-semibold">
                      {formatCurrency(item.product.price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-blue-200 pt-3">
              <div className="mb-3 flex items-center justify-between font-bold">
                <span>Total</span>
                <span className="text-blue-900">{formatCurrency(cartTotal)}</span>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-blue-900">
                  Forma de pagamento
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecionar (opcional)</option>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <textarea
                placeholder="Observações do pedido (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mb-3 w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
              <p className="mb-3 text-xs text-blue-900">
                ⚠️ Os preços serão exibidos após a aprovação do pedido.
              </p>
              <Button onClick={submitOrder} disabled={loading} className="w-full">
                <Send className="h-4 w-4" />
                {loading ? "Enviando..." : "Enviar Pedido para Aprovação"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              !selectedCategory
                ? "bg-blue-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() =>
                setSelectedCategory(
                  selectedCategory === cat.id ? null : cat.id
                )
              }
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === cat.id
                  ? "bg-blue-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((product) => {
          const cartItem = cart[product.id];
          return (
            <Card key={product.id}>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-blue-100 overflow-hidden">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt={product.name} className="h-10 w-10 object-cover rounded-md" />
                    ) : (
                      <Package className="h-5 w-5 text-blue-800" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{product.name}</p>
                    {product.description && (
                      <p className="text-xs text-gray-400 truncate">
                        {product.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs text-gray-400">por {product.unit}</p>
                    {product.minQuantity && (
                      <p className="text-xs text-gray-400">
                        Mín: {product.minQuantity} {product.unit}
                      </p>
                    )}
                    {product.shelfLifeDays && (
                      <p className="flex items-center gap-1 text-xs text-blue-500">
                        <Clock className="h-3 w-3" />
                        Validade: {product.shelfLifeDays}{" "}
                        {product.shelfLifeDays === 1 ? "dia" : "dias"}
                      </p>
                    )}
                  </div>

                  {!cartItem ? (
                    <Button size="sm" onClick={() => addToCart(product)}>
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQty(
                            product.id,
                            cartItem.quantity - (product.minQuantity ?? 1)
                          )
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white hover:bg-gray-100"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="min-w-[2.5rem] text-center text-sm font-semibold">
                        {cartItem.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQty(
                            product.id,
                            cartItem.quantity + (product.minQuantity ?? 1)
                          )
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white hover:bg-gray-100"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Package className="mb-4 h-12 w-12 text-gray-200" />
          <p>Nenhum produto encontrado.</p>
        </div>
      )}
    </div>
  );
}
