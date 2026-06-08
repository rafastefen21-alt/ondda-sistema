"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function CredenciaisCard({
  clientId,
  email,
}: {
  clientId: string;
  email: string;
}) {
  const [password,    setPassword]    = useState("");
  const [showPw,      setShowPw]      = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [error,       setError]       = useState("");

  async function handleSave() {
    if (!password || password.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    setError("");
    setSaving(true);
    setSuccess(false);
    try {
      const res = await fetch(`/api/clientes/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Erro ao salvar.");
      } else {
        setSuccess(true);
        setPassword("");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-gray-400" />
          Credenciais de acesso à loja
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Email */}
        <div className="space-y-1">
          <Label className="text-xs text-gray-500 uppercase tracking-wide">E-mail</Label>
          <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <Mail className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="text-sm font-medium text-gray-800 break-all">{email}</span>
          </div>
          <p className="text-xs text-gray-400">Login utilizado pelo cliente na loja virtual.</p>
        </div>

        {/* Redefinir senha */}
        <div className="space-y-1.5">
          <Label htmlFor="nova-senha" className="text-xs text-gray-500 uppercase tracking-wide">
            Nova senha
          </Label>
          <div className="relative">
            <Input
              id="nova-senha"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); setSuccess(false); }}
              placeholder="Digite para redefinir a senha"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-400">Deixe em branco para manter a senha atual.</p>
        </div>

        {error   && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        {success && <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">Senha atualizada com sucesso!</p>}

        <Button
          size="sm"
          disabled={saving || !password}
          onClick={handleSave}
          className="w-full"
        >
          {saving ? "Salvando..." : "Redefinir senha"}
        </Button>
      </CardContent>
    </Card>
  );
}
