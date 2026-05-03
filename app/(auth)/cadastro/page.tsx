"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import {
  Eye, EyeOff, CheckCircle, XCircle, Loader2, Store,
} from "lucide-react";
import { AnimatedWaves } from "@/components/ui/animated-waves";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ── Slug generator ─────────────────────────────────────────────────────────
function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

type SlugState = "idle" | "checking" | "available" | "taken" | "invalid";

export default function CadastroPage() {
  const router = useRouter();

  // Empresa
  const [companyName, setCompanyName] = useState("");
  const [cnpj,        setCnpj]        = useState("");
  const [slug,        setSlug]        = useState("");
  const [slugState,   setSlugState]   = useState<SlugState>("idle");
  const [slugMsg,     setSlugMsg]     = useState("");
  const slugAutoRef = useRef(true); // true enquanto o slug segue o nome

  // Usuário admin
  const [name,            setName]            = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass,        setShowPass]        = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // ── Auto-gera slug a partir do nome da empresa ──────────────────────────
  useEffect(() => {
    if (!slugAutoRef.current) return;
    setSlug(toSlug(companyName));
  }, [companyName]);

  // ── Valida slug (debounce 500ms) ────────────────────────────────────────
  useEffect(() => {
    if (!slug) { setSlugState("idle"); return; }
    if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 2) {
      setSlugState("invalid");
      setSlugMsg("Use apenas letras minúsculas, números e hífens.");
      return;
    }

    setSlugState("checking");
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/cadastro/check-slug?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (data.available) {
          setSlugState("available");
          setSlugMsg("Disponível!");
        } else {
          setSlugState("taken");
          setSlugMsg(data.error ?? "Já está em uso.");
        }
      } catch {
        setSlugState("idle");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug]);

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (slugState === "taken" || slugState === "invalid") {
      setError("Escolha um endereço de loja válido e disponível.");
      return;
    }

    setLoading(true);

    // 1. Cria tenant + admin
    const res = await fetch("/api/cadastro", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ companyName, slug, name, email, password, cnpj: cnpj || undefined }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Erro ao criar conta.");
      setLoading(false);
      return;
    }

    // 2. Faz login automático
    const loginResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (loginResult?.error) {
      setError("Conta criada! Faça login para continuar.");
      router.push("/login");
      return;
    }

    router.push("/dashboard");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const slugPreview = `${appUrl}/loja/${slug || "minha-loja"}`;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <AnimatedWaves />
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <Image
            src="/ondda-logo.png"
            alt="Ondda"
            width={120}
            height={120}
            className="mb-3 h-24 w-auto rounded-2xl shadow-lg"
          />
          <p className="mt-1 text-sm text-gray-500">
            Crie sua conta e comece a gerenciar sua distribuidora
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Bloco 1: Sua empresa ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Sua empresa
            </h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="companyName">Nome da empresa *</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: Distribuidora Casa do Pão"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
                <p className="text-xs text-gray-400">Opcional — pode preencher depois nas configurações.</p>
              </div>

              {/* Slug */}
              <div className="space-y-1.5">
                <Label htmlFor="slug">Endereço da sua loja *</Label>
                <div className="relative">
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => {
                      slugAutoRef.current = false; // usuário editou manualmente
                      setSlug(e.target.value.toLowerCase());
                    }}
                    placeholder="minha-loja"
                    required
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {slugState === "checking"   && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                    {slugState === "available"  && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {(slugState === "taken" || slugState === "invalid") && <XCircle className="h-4 w-4 text-red-500" />}
                  </span>
                </div>

                {/* Feedback do slug */}
                {slugState === "available" && (
                  <p className="text-xs text-green-600">{slugMsg}</p>
                )}
                {(slugState === "taken" || slugState === "invalid") && (
                  <p className="text-xs text-red-500">{slugMsg}</p>
                )}

                {/* Preview da URL */}
                <div className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                  <Store className="h-3.5 w-3.5 flex-shrink-0 text-blue-700" />
                  <p className="truncate text-xs text-gray-500">
                    Loja pública:{" "}
                    <span className="font-mono font-medium text-gray-800">{slugPreview}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Bloco 2: Seu acesso ── */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Seu acesso
            </h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Seu nome *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: João Silva"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="joao@empresa.com.br"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mín. 6 caracteres"
                      minLength={6}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirmar senha *</Label>
                  <Input
                    id="confirmPassword"
                    type={showPass ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    minLength={6}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading || slugState === "taken" || slugState === "invalid" || slugState === "checking"}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando conta...</>
            ) : (
              "Criar minha conta"
            )}
          </Button>

          <p className="text-center text-sm text-gray-500">
            Já tem uma conta?{" "}
            <Link href="/login" className="font-medium text-blue-800 hover:text-blue-900">
              Entrar
            </Link>
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Ondda. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
