"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

function RedefinirForm() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [done,        setDone]        = useState(false);
  const [error,       setError]       = useState("");

  useEffect(() => {
    if (!token || !email) setError("Link inválido. Solicite um novo.");
  }, [token, email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("A senha deve ter no mínimo 6 caracteres."); return; }
    if (password !== confirm) { setError("As senhas não coincidem."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/redefinir-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro ao redefinir senha."); return; }
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          {done ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Senha redefinida!</h2>
              <p className="mt-2 text-sm text-gray-500">
                Sua senha foi alterada com sucesso. Redirecionando para o login…
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-100">
                  <KeyRound className="h-5 w-5 text-blue-800" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Criar nova senha</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Escolha uma senha segura para a conta <strong>{email}</strong>.
                </p>
              </div>

              {error && !token ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                  <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-500" />
                  <p className="text-sm text-red-700">{error}</p>
                  <Link
                    href="/esqueci-senha"
                    className="mt-3 inline-block text-sm font-medium text-blue-800 hover:underline"
                  >
                    Solicitar novo link
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Nova senha</Label>
                    <div className="relative">
                      <Input
                        type={showPass ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10"
                        required
                        autoFocus
                      />
                      <button type="button" onClick={() => setShowPass((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Confirmar nova senha</Label>
                    <div className="relative">
                      <Input
                        type={showConfirm ? "text" : "password"}
                        placeholder="Repita a senha"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        className="pr-10"
                        required
                      />
                      <button type="button" onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
                  )}

                  <Button type="submit" className="w-full" disabled={loading || !password || !confirm}>
                    {loading ? "Salvando..." : "Salvar nova senha"}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <Suspense>
      <RedefinirForm />
    </Suspense>
  );
}
