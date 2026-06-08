"use client";

import { useState, useEffect } from "react";
import {
  ShoppingCart, Plus, Minus, Package, Search, Clock,
  X, Send, LogIn, UserPlus, CheckCircle2, ChevronRight,
  Lock, Eye, EyeOff, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = "unidade" | "pacote" | "caixa";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  minQuantity?: number;
  shelfLifeDays?: number | null;
  weightGrams?: number | null;
  diameterCm?: number | null;
  pricePacote: number | null;
  priceCaixa: number | null;
  labelPacote: string | null;
  labelCaixa: string | null;
  categoryId: string | null;
  categoryName: string | null;
  imageUrl?: string | null;
}

interface Category { id: string; name: string }

interface CartItem {
  product: Product;
  quantity: number;
  tier: Tier;
  unitPrice: number;
  tierLabel: string;
}

type CheckoutTab = "novo" | "existente";
type Step = "catalogo" | "checkout" | "sucesso";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPrice(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function cartKey(productId: string, tier: Tier) {
  return `${productId}-${tier}`;
}

function tiersOf(
  p: Product,
  customPrices: CustomPrice[] = [],
): { tier: Tier; price: number; label: string }[] {
  const custom = customPrices.find((c) => c.productId === p.id);
  const tiers: { tier: Tier; price: number; label: string }[] = [
    { tier: "unidade", price: custom?.price ?? p.price, label: `${p.unit}` },
  ];
  if (p.pricePacote && p.labelPacote) {
    tiers.push({
      tier:  "pacote",
      price: custom?.pricePacote ?? p.pricePacote,
      label: p.labelPacote,
    });
  }
  if (p.priceCaixa && p.labelCaixa) {
    tiers.push({
      tier:  "caixa",
      price: custom?.priceCaixa ?? p.priceCaixa,
      label: p.labelCaixa,
    });
  }
  return tiers;
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface TenantInfo {
  name: string;
  slug: string;
  corPrimaria: string;
  bannerUrl: string | null;
  logoUrl: string | null;
  descricao: string | null;
  pedidoMinimo: number;
}

// ─── Loja session (localStorage) ─────────────────────────────────────────────
interface CustomPrice {
  productId:   string;
  price:       number | null;
  pricePacote: number | null;
  priceCaixa:  number | null;
}

interface LojaSession {
  id:           string;
  name:         string | null;
  email:        string;
  active:       boolean;
  customPrices: CustomPrice[];
}

const SESSION_KEY = (slug: string) => `loja_session_${slug}`;

export function LojaClient({
  tenant,
  products,
  categories,
}: {
  tenant: TenantInfo;
  products: Product[];
  categories: Category[];
}) {
  const [step, setStep] = useState<Step>("catalogo");
  const [cart, setCart] = useState<Record<string, CartItem>>({});

  // ── Sessão do cliente na loja ──────────────────────────────────────────────
  const [lojaSession,    setLojaSession]    = useState<LojaSession | null>(null);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [loginEmail,     setLoginEmail]     = useState("");
  const [loginPassword,  setLoginPassword]  = useState("");
  const [loginLoading,   setLoginLoading]   = useState(false);
  const [loginError,     setLoginError]     = useState("");
  const [showLoginPass,  setShowLoginPass]  = useState(false);

  // Carrega sessão salva
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY(tenant.slug));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<LojaSession>;
        // Garante compatibilidade com sessões antigas sem customPrices
        setLojaSession({ customPrices: [], ...parsed } as LojaSession);
      }
    } catch { /* ignora */ }
  }, [tenant.slug]);

  function saveSession(s: LojaSession) {
    setLojaSession(s);
    localStorage.setItem(SESSION_KEY(tenant.slug), JSON.stringify(s));
    setShowLoginPanel(false);
    setLoginEmail("");
    setLoginPassword("");
    setLoginError("");
  }

  function logout() {
    setLojaSession(null);
    localStorage.removeItem(SESSION_KEY(tenant.slug));
    setCart({});
  }

  async function handleLojaLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res  = await fetch(`/api/loja/${tenant.slug}/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error ?? "Erro ao entrar."); return; }
      saveSession(data as LojaSession);
    } catch {
      setLoginError("Erro de conexão. Tente novamente.");
    } finally {
      setLoginLoading(false);
    }
  }

  // Preços visíveis apenas para clientes aprovados
  const showPrices = lojaSession?.active === true;
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tab, setTab] = useState<CheckoutTab>("novo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orderInfo, setOrderInfo] = useState<{ id: string | null; email: string } | null>(null);

  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "", cnpj: "", notes: "",
    loginEmail: "", loginPassword: "",
    // Endereço
    cep: "", logradouro: "", numero: "", complemento: "", bairro: "", city: "", state: "",
  });

  // CNPJ lookup state
  const [cnpjLoading,  setCnpjLoading]  = useState(false);
  const [cnpjAddress,  setCnpjAddress]  = useState<{
    cep: string; logradouro: string; numero: string; complemento: string;
    bairro: string; city: string; state: string;
  } | null>(null);
  const [sameAddress,  setSameAddress]  = useState(false);
  const [showManual,   setShowManual]   = useState(false);

  async function lookupCnpj(cnpj: string) {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return;
    setCnpjLoading(true);
    setCnpjAddress(null);
    setSameAddress(false);
    setShowManual(false);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) { setShowManual(true); return; }
      const d = await res.json();
      const addr = {
        cep:         (d.cep ?? "").replace(/\D/g, ""),
        logradouro:  d.logradouro   ?? "",
        numero:      d.numero       ?? "",
        complemento: d.complemento  ?? "",
        bairro:      d.bairro       ?? "",
        city:        d.municipio    ?? "",
        state:       d.uf           ?? "",
      };
      setCnpjAddress(addr);
      // Preenche também o nome se ainda vazio
      if (!form.name && d.razao_social) {
        setForm((f) => ({ ...f, name: d.razao_social }));
      }
    } catch {
      setShowManual(true);
    } finally {
      setCnpjLoading(false);
    }
  }

  function applyAddress(addr: typeof cnpjAddress) {
    if (!addr) return;
    setForm((f) => ({ ...f, ...addr }));
  }

  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  // Pedido mínimo só se aplica a clientes aprovados (que já viram os preços)
  const belowMinimo = lojaSession?.active === true && tenant.pedidoMinimo > 0 && cartTotal < tenant.pedidoMinimo;

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !selectedCategory || p.categoryId === selectedCategory;
    return matchSearch && matchCat;
  });

  function addToCart(product: Product, tier: Tier, price: number, label: string) {
    const key = cartKey(product.id, tier);
    const step = product.minQuantity ?? 1;
    setCart((prev) => {
      const existing = prev[key];
      return {
        ...prev,
        [key]: {
          product,
          tier,
          unitPrice: price,
          tierLabel: label,
          quantity: existing ? existing.quantity + step : step,
        },
      };
    });
  }

  function updateQty(key: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => { const n = { ...prev }; delete n[key]; return n; });
    } else {
      setCart((prev) => ({ ...prev, [key]: { ...prev[key], quantity: qty } }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const items = cartItems.map((i) => ({
      productId: i.product.id,
      quantity: i.quantity,
      tier: i.tier,
    }));

    // Resolve endereço: CNPJ ou manual
    const addrFields = sameAddress && cnpjAddress
      ? cnpjAddress
      : { cep: form.cep, logradouro: form.logradouro, numero: form.numero,
          complemento: form.complemento, bairro: form.bairro, city: form.city, state: form.state };

    const body = tab === "novo"
      ? { type: "novo", name: form.name, email: form.email, password: form.password,
          phone: form.phone, cnpj: form.cnpj, notes: form.notes, ...addrFields, items }
      : { type: "existente", email: form.loginEmail, password: form.loginPassword, notes: form.notes, items };

    const res = await fetch(`/api/loja/${tenant.slug}/pedido`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erro ao enviar pedido. Tente novamente.");
      return;
    }

    const json = await res.json();
    setOrderInfo({ id: json.orderId ?? null, email: tab === "novo" ? form.email : form.loginEmail });
    setStep("sucesso");
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (step === "sucesso" && orderInfo) {
    const isOnlyRegistration = !orderInfo.id;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>

          {isOnlyRegistration ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Cadastro realizado!</h1>
              <p className="mt-2 text-gray-500">
                Seu cadastro está sendo analisado. Em breve você receberá acesso
                para ver os preços e fazer pedidos.
              </p>
              <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 text-left">
                <p className="text-sm text-gray-500">
                  Acesso com o email <strong>{orderInfo.email}</strong> assim que sua conta for aprovada.
                </p>
              </div>
              <button
                onClick={() => setStep("catalogo")}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-800 px-6 py-3 font-medium text-white hover:bg-blue-900"
              >
                Voltar à loja
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Pedido enviado!</h1>
              <p className="mt-2 text-gray-500">
                Seu pedido foi recebido e está aguardando aprovação.
                Você será notificado sobre o andamento.
              </p>
              <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 text-left">
                <p className="text-sm text-gray-500">Número do pedido</p>
                <p className="mt-1 font-mono text-sm font-semibold text-gray-900">
                  #{orderInfo.id!.slice(-8).toUpperCase()}
                </p>
                <p className="mt-3 text-sm text-gray-500">
                  Use o email <strong>{orderInfo.email}</strong> e sua senha para acompanhar o pedido.
                </p>
              </div>
              <a
                href={`/login?callbackUrl=/pedidos/${orderInfo.id}`}
                className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-blue-800 px-6 py-3 font-medium text-white hover:bg-blue-900"
              >
                Acompanhar pedido
                <ChevronRight className="h-4 w-4" />
              </a>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Checkout screen ─────────────────────────────────────────────────────────
  if (step === "checkout") {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white px-4 py-4">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <button
              onClick={() => setStep("catalogo")}
              className="rounded-md p-1 hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
            <div>
              <h1 className="font-bold text-gray-900">Finalizar Pedido</h1>
              <p className="text-xs text-gray-400">{tenant.name}</p>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
          {/* Cart summary */}
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 font-semibold text-gray-900">
                Resumo do pedido ({cartCount} iten(s))
              </h2>
              <div className="divide-y divide-gray-100">
                {cartItems.map((item) => {
                  const key = cartKey(item.product.id, item.tier);
                  const step = item.product.minQuantity ?? 1;
                  return (
                    <div key={key} className="flex items-center justify-between py-2 gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">{item.product.name}</p>
                        <p className="text-xs text-gray-400">{item.tierLabel} · {fmtPrice(item.unitPrice)}/un</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => updateQty(key, item.quantity - step)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-14 text-center text-sm font-medium">
                          {item.quantity} {item.product.unit}
                        </span>
                        <button
                          onClick={() => updateQty(key, item.quantity + step)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-100"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <span className="w-20 text-right text-sm font-semibold text-gray-800">
                          {fmtPrice(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-between border-t border-gray-100 pt-3">
                <span className="text-sm font-semibold text-gray-700">Total estimado</span>
                <span className="text-sm font-bold text-gray-900">{fmtPrice(cartTotal)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                * Preços sujeitos a confirmação na aprovação do pedido.
              </p>
            </CardContent>
          </Card>

          {/* Auth tabs */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-4 flex rounded-lg border border-gray-200 p-1">
                <button
                  onClick={() => setTab("novo")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
                    tab === "novo"
                      ? "bg-blue-800 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <UserPlus className="h-4 w-4" />
                  Primeiro pedido
                </button>
                <button
                  onClick={() => setTab("existente")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
                    tab === "existente"
                      ? "bg-blue-800 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <LogIn className="h-4 w-4" />
                  Já tenho conta
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {tab === "novo" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Nome / Razão Social *</Label>
                      <Input
                        id="name"
                        placeholder="Ex: Padaria Boa Sorte"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="contato@padaria.com.br"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value.toLowerCase() }))}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="password">Senha *</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Mínimo 6 caracteres"
                          minLength={6}
                          value={form.password}
                          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="phone">Telefone</Label>
                        <Input
                          id="phone"
                          placeholder="(11) 99999-0000"
                          value={form.phone}
                          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        />
                      </div>
                    </div>
                    {/* CNPJ com auto-preenchimento de endereço */}
                    <div className="space-y-1.5">
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <div className="relative">
                        <Input
                          id="cnpj"
                          placeholder="00.000.000/0001-00"
                          value={form.cnpj}
                          onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                          onBlur={(e) => lookupCnpj(e.target.value)}
                        />
                        {cnpjLoading && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 animate-pulse">
                            Consultando...
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Endereço de entrega ─────────────────────────────── */}
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-700">Endereço de entrega</p>

                        {/* Checkbox "mesmo do CNPJ" — só aparece quando CNPJ encontrado */}
                        {cnpjAddress && (
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={sameAddress}
                              onChange={(e) => {
                                setSameAddress(e.target.checked);
                                if (e.target.checked) applyAddress(cnpjAddress);
                              }}
                              className="h-4 w-4 rounded border-gray-300 accent-blue-700"
                            />
                            <span className="text-xs font-medium text-blue-900">
                              Mesmo endereço do CNPJ
                            </span>
                          </label>
                        )}
                      </div>

                      {/* Campos sempre visíveis; auto-preenchidos quando sameAddress */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">CEP</Label>
                          <Input
                            placeholder="00000-000"
                            value={form.cep}
                            readOnly={sameAddress}
                            onChange={(e) => setForm((f) => ({ ...f, cep: e.target.value }))}
                            className={sameAddress ? "bg-blue-50 text-gray-600" : ""}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Número</Label>
                          <Input
                            placeholder="123"
                            value={form.numero}
                            readOnly={sameAddress}
                            onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
                            className={sameAddress ? "bg-blue-50 text-gray-600" : ""}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Logradouro</Label>
                        <Input
                          placeholder="Rua, Avenida..."
                          value={form.logradouro}
                          readOnly={sameAddress}
                          onChange={(e) => setForm((f) => ({ ...f, logradouro: e.target.value }))}
                          className={sameAddress ? "bg-blue-50 text-gray-600" : ""}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Bairro</Label>
                          <Input
                            placeholder="Bairro"
                            value={form.bairro}
                            readOnly={sameAddress}
                            onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))}
                            className={sameAddress ? "bg-blue-50 text-gray-600" : ""}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Complemento</Label>
                          <Input
                            placeholder="Sala, Apto..."
                            value={form.complemento}
                            onChange={(e) => setForm((f) => ({ ...f, complemento: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Cidade</Label>
                          <Input
                            placeholder="São Paulo"
                            value={form.city}
                            readOnly={sameAddress}
                            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                            className={sameAddress ? "bg-blue-50 text-gray-600" : ""}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Estado</Label>
                          <Input
                            placeholder="SP"
                            maxLength={2}
                            value={form.state}
                            readOnly={sameAddress}
                            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
                            className={sameAddress ? "bg-blue-50 text-gray-600" : ""}
                          />
                        </div>
                      </div>

                      {sameAddress && (
                        <p className="text-[11px] text-blue-600">
                          Preenchido automaticamente pelo CNPJ. Desmarque para editar.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="loginEmail">Email *</Label>
                      <Input
                        id="loginEmail"
                        type="email"
                        placeholder="seu@email.com.br"
                        value={form.loginEmail}
                        onChange={(e) => setForm((f) => ({ ...f, loginEmail: e.target.value.toLowerCase() }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="loginPassword">Senha *</Label>
                        <a
                          href="/esqueci-senha"
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-700 hover:underline"
                        >
                          Esqueci minha senha
                        </a>
                      </div>
                      <Input
                        id="loginPassword"
                        type="password"
                        placeholder="••••••••"
                        value={form.loginPassword}
                        onChange={(e) => setForm((f) => ({ ...f, loginPassword: e.target.value }))}
                        required
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="notes">Observações do pedido</Label>
                  <textarea
                    id="notes"
                    placeholder="Ex: Entrega preferencialmente pela manhã"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    className="flex min-h-[72px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                    rows={2}
                  />
                </div>

                {belowMinimo && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <p className="font-medium">Pedido mínimo não atingido</p>
                    <p className="text-xs mt-0.5">
                      Mínimo: <strong>{fmtPrice(tenant.pedidoMinimo)}</strong> · Atual: <strong>{fmtPrice(cartTotal)}</strong> · Faltam <strong>{fmtPrice(tenant.pedidoMinimo - cartTotal)}</strong>
                    </p>
                  </div>
                )}

                {error && (
                  <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || (tab === "existente" && cartItems.length === 0) || belowMinimo}
                >
                  <Send className="h-4 w-4" />
                  {loading
                    ? "Enviando..."
                    : tab === "novo" && cartItems.length === 0
                      ? "Fazer Cadastro"
                      : "Enviar Pedido"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Catalog screen ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {tenant.bannerUrl && (
        <div
          className="h-36 w-full bg-cover bg-center sm:h-48"
          style={{ backgroundImage: `url(${tenant.bannerUrl})` }}
        />
      )}

      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {tenant.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenant.logoUrl} alt={tenant.name} className="h-10 w-10 rounded-xl object-contain" />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: tenant.corPrimaria }}
                >
                  <Package className="h-5 w-5 text-white" />
                </div>
              )}
              <div>
                <h1 className="font-bold text-gray-900">{tenant.name}</h1>
                <p className="text-xs text-gray-400">
                  {tenant.descricao ?? "Faça seu pedido online"}
                </p>
              </div>
            </div>

            {cartCount > 0 && (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={() => setStep("checkout")}
                  className="relative flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>{fmtPrice(cartTotal)}</span>
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-xs text-white">
                    {cartItems.length}
                  </span>
                </button>
                {belowMinimo && (
                  <p className="text-xs font-medium text-amber-700">
                    Mín. {fmtPrice(tenant.pedidoMinimo)} · faltam {fmtPrice(tenant.pedidoMinimo - cartTotal)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Search + filters */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
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
                  !selectedCategory ? "bg-blue-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedCategory === cat.id ? "bg-blue-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Products */}
      <main className="mx-auto max-w-6xl px-4 py-6">

        {/* ── Painel de sessão / login ───────────────────────────────────────── */}
        {lojaSession ? (
          // Cliente logado
          <div className={`mb-5 flex items-center justify-between rounded-xl border px-4 py-3 ${
            lojaSession.active
              ? "border-green-200 bg-green-50"
              : "border-yellow-200 bg-yellow-50"
          }`}>
            <div>
              {lojaSession.active ? (
                <>
                  <p className="text-sm font-semibold text-green-800">
                    Olá, {lojaSession.name ?? lojaSession.email}! 👋
                  </p>
                  <p className="text-xs text-green-700">Você está logado e pode ver os preços.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-yellow-800">
                    Cadastro em análise
                  </p>
                  <p className="text-xs text-yellow-700">
                    Seu cadastro está sendo analisado. Os preços serão liberados após a aprovação.
                  </p>
                </>
              )}
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        ) : showLoginPanel ? (
          // Formulário de login inline
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-blue-900">Entrar para ver os preços</p>
              <button onClick={() => setShowLoginPanel(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleLojaLogin} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-blue-800">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value.toLowerCase())}
                  placeholder="seu@email.com"
                  required
                  autoFocus
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-blue-800">Senha</label>
                <div className="relative">
                  <input
                    type={showLoginPass ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 pr-9 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loginLoading}
                className="flex items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: tenant.corPrimaria }}
              >
                {loginLoading
                  ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  : <LogIn className="h-4 w-4" />}
                {loginLoading ? "Entrando..." : "Entrar"}
              </button>
            </form>
            {loginError && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs text-red-600">{loginError}</p>
                <a
                  href="/esqueci-senha"
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-xs font-medium text-blue-700 hover:underline"
                >
                  Esqueci minha senha
                </a>
              </div>
            )}
            {!loginError && (
              <div className="mt-2 flex justify-end">
                <a
                  href="/esqueci-senha"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-gray-400 hover:text-blue-700 hover:underline"
                >
                  Esqueci minha senha
                </a>
              </div>
            )}
            <p className="mt-2 text-xs text-blue-700">
              Ainda não tem cadastro?{" "}
              <button
                onClick={() => { setShowLoginPanel(false); setStep("checkout"); }}
                className="font-semibold underline"
              >
                Faça seu primeiro cadastro
              </button>{" "}
              para ver os preços.
            </p>
          </div>
        ) : (
          // Não logado — banner de convite
          <div
            className="mb-5 flex items-center justify-between rounded-xl border border-dashed px-4 py-3"
            style={{ borderColor: tenant.corPrimaria + "60", backgroundColor: tenant.corPrimaria + "10" }}
          >
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 shrink-0" style={{ color: tenant.corPrimaria }} />
              <div>
                <p className="text-sm font-semibold text-gray-800">Preços disponíveis para clientes aprovados</p>
                <p className="text-xs text-gray-500">Faça login para ver os preços e adicionar ao carrinho.</p>
              </div>
            </div>
            <button
              onClick={() => setShowLoginPanel(true)}
              className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: tenant.corPrimaria }}
            >
              Entrar
            </button>
          </div>
        )}

        <p className="mb-4 text-sm text-gray-500">
          {filtered.length} produto(s) disponível(is)
        </p>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => {
            const allTiers = tiersOf(product, lojaSession?.customPrices ?? []);
            // Mostra só caixa; fallback para pacote se não houver caixa; fallback para unidade se não houver nenhum
            const caixaTiers  = allTiers.filter((t) => t.tier === "caixa");
            const pacoteTiers = allTiers.filter((t) => t.tier === "pacote");
            const tiers = caixaTiers.length > 0
              ? caixaTiers
              : pacoteTiers.length > 0
              ? pacoteTiers
              : allTiers;
            return (
              <div
                key={product.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Photo */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-blue-50">
                      <Package className="h-14 w-14 text-blue-200" />
                    </div>
                  )}
                  <div className="absolute left-2 top-2 flex flex-col gap-1">
                    {product.minQuantity && (
                      <span className="rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                        Mín: {product.minQuantity} {product.unit}
                      </span>
                    )}
                    {product.shelfLifeDays && (
                      <span className="flex items-center gap-1 rounded-full bg-blue-600/80 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                        <Clock className="h-3 w-3" />
                        {product.shelfLifeDays}d validade
                      </span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-bold leading-snug text-gray-900 line-clamp-2">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                  {(product.weightGrams || product.diameterCm || product.shelfLifeDays) && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {product.weightGrams && (
                        <span className="text-xs text-gray-400">Peso - {product.weightGrams} gr</span>
                      )}
                      {product.diameterCm && (
                        <span className="text-xs text-gray-400">Diâmetro - {product.diameterCm} cm</span>
                      )}
                      {product.shelfLifeDays && (
                        <span className="text-xs text-gray-400">Validade - {product.shelfLifeDays} dias</span>
                      )}
                    </div>
                  )}

                  {/* Tiers */}
                  <div className="mt-3 space-y-2">
                    {showPrices ? (
                      tiers.map(({ tier, price, label }) => {
                        const key = cartKey(product.id, tier);
                        const cartItem = cart[key];
                        const step = product.minQuantity ?? 1;

                        return (
                          <div key={tier} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs text-gray-500">{label}</p>
                              <p className="text-sm font-bold text-gray-900">{fmtPrice(price)}</p>
                            </div>

                            {!cartItem ? (
                              <button
                                onClick={() => addToCart(product, tier, price, label)}
                                className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 active:scale-95"
                                style={{ backgroundColor: tenant.corPrimaria }}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Adicionar
                              </button>
                            ) : (
                              <div
                                className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1"
                                style={{ backgroundColor: `${tenant.corPrimaria}20` }}
                              >
                                <button
                                  onClick={() => updateQty(key, cartItem.quantity - step)}
                                  className="flex h-6 w-6 items-center justify-center rounded-md bg-white shadow-sm hover:bg-gray-50"
                                >
                                  <Minus className="h-3 w-3 text-gray-700" />
                                </button>
                                <span
                                  className="min-w-[2.5rem] text-center text-sm font-bold tabular-nums"
                                  style={{ color: tenant.corPrimaria }}
                                >
                                  {cartItem.quantity}
                                </span>
                                <button
                                  onClick={() => updateQty(key, cartItem.quantity + step)}
                                  className="flex h-6 w-6 items-center justify-center rounded-md text-white shadow-sm"
                                  style={{ backgroundColor: tenant.corPrimaria }}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      // Preços bloqueados
                      <button
                        onClick={() => setShowLoginPanel(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2.5 text-xs font-medium text-gray-400 transition hover:border-gray-400 hover:text-gray-600"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        Ver preço
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="mb-4 h-12 w-12 text-gray-200" />
            <p className="text-gray-400">Nenhum produto encontrado.</p>
          </div>
        )}
      </main>

      {/* Sticky bottom bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4 shadow-lg">
          <div className="mx-auto max-w-5xl">
            <button
              onClick={() => setStep("checkout")}
              className="flex w-full items-center justify-between rounded-xl bg-blue-800 px-5 py-3 font-semibold text-white hover:bg-blue-900"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {cartItems.length} produto(s) · {cartCount} iten(s)
              </span>
              <span className="flex items-center gap-1">
                {fmtPrice(cartTotal)}
                <ChevronRight className="h-4 w-4" />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
