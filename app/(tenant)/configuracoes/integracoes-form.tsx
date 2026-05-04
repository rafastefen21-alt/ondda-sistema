"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle, CreditCard, Eye, EyeOff, Link2, FileText,
  AlertCircle, User, LogOut, Loader2,
} from "lucide-react";

const selectClass =
  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2";

interface MpAccount {
  id:       number;
  nickname: string | null;
  email:    string | null;
  fullName: string | null;
  siteId:   string | null;
}

interface Props {
  initial: {
    mpPublicKey:   string | null;
    mpAccessToken: string | null;
    focusNfeToken: string | null;
    nfeAmbiente:   string | null;
  };
}

export function IntegracoesForm({ initial }: Props) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Lê feedback do OAuth via URL param e limpa a URL logo depois
  const [oauthMsg, setOauthMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const mp   = searchParams.get("mp");
    const erro = searchParams.get("erro");
    if (mp === "conectado") {
      setOauthMsg({ type: "success", text: "Mercado Pago conectado com sucesso!" });
      router.replace("/configuracoes");
    } else if (erro) {
      setOauthMsg({ type: "error", text: decodeURIComponent(erro) });
      router.replace("/configuracoes");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mercado Pago state ────────────────────────────────────────────────────────
  const [mpConfigured,  setMpConfigured]  = useState(!!(initial.mpPublicKey && initial.mpAccessToken));
  const [mpPublicKey,   setMpPublicKey]   = useState(initial.mpPublicKey   ?? "");
  const [mpAccessToken, setMpAccessToken] = useState(initial.mpAccessToken ?? "");
  const [showMpToken,   setShowMpToken]   = useState(false);
  const [loadingMp,     setLoadingMp]     = useState(false);
  const [successMp,     setSuccessMp]     = useState(false);
  const [errorMp,       setErrorMp]       = useState("");

  // Conta MP conectada
  const [mpAccount,        setMpAccount]        = useState<MpAccount | null>(null);
  const [mpAccountLoading, setMpAccountLoading] = useState(false);
  const [disconnecting,    setDisconnecting]    = useState(false);

  // Busca info da conta quando configurado
  useEffect(() => {
    if (!mpConfigured) return;
    setMpAccountLoading(true);
    fetch("/api/configuracoes/mp-info")
      .then((r) => r.json())
      .then((data) => {
        if (data.email || data.nickname) setMpAccount(data);
      })
      .catch(() => {})
      .finally(() => setMpAccountLoading(false));
  }, [mpConfigured]);

  // ── Focus NF-e state ─────────────────────────────────────────────────────────
  const [focusNfeToken, setFocusNfeToken] = useState(initial.focusNfeToken ?? "");
  const [nfeAmbiente,   setNfeAmbiente]   = useState(initial.nfeAmbiente   ?? "homologacao");
  const [showNfeToken,  setShowNfeToken]  = useState(false);
  const [loadingNfe,    setLoadingNfe]    = useState(false);
  const [successNfe,    setSuccessNfe]    = useState(false);
  const [errorNfe,      setErrorNfe]      = useState("");

  // ── Salvar credenciais MP manualmente ────────────────────────────────────────
  async function saveMp(e: React.FormEvent) {
    e.preventDefault();
    setLoadingMp(true);
    setErrorMp("");
    setSuccessMp(false);
    const res = await fetch("/api/configuracoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mpPublicKey: mpPublicKey || null, mpAccessToken: mpAccessToken || null }),
    });
    setLoadingMp(false);
    if (!res.ok) {
      setErrorMp("Erro ao salvar. Verifique os dados e tente novamente.");
    } else {
      setSuccessMp(true);
      setMpConfigured(!!(mpPublicKey && mpAccessToken));
      router.refresh();
      setTimeout(() => setSuccessMp(false), 3000);
    }
  }

  // ── Desconectar MP ────────────────────────────────────────────────────────────
  async function disconnectMp() {
    setDisconnecting(true);
    const res = await fetch("/api/configuracoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mpPublicKey: null, mpAccessToken: null }),
    });
    setDisconnecting(false);
    if (res.ok) {
      setMpPublicKey("");
      setMpAccessToken("");
      setMpConfigured(false);
      setMpAccount(null);
      router.refresh();
    }
  }

  // ── Salvar NF-e ──────────────────────────────────────────────────────────────
  async function saveNfe(e: React.FormEvent) {
    e.preventDefault();
    setLoadingNfe(true);
    setErrorNfe("");
    setSuccessNfe(false);
    const res = await fetch("/api/configuracoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focusNfeToken: focusNfeToken || null, nfeAmbiente }),
    });
    setLoadingNfe(false);
    if (!res.ok) {
      setErrorNfe("Erro ao salvar. Verifique os dados e tente novamente.");
    } else {
      setSuccessNfe(true);
      router.refresh();
      setTimeout(() => setSuccessNfe(false), 3000);
    }
  }

  const nfeConfigured = !!initial.focusNfeToken;

  return (
    <div className="space-y-4">
      {/* ── Mercado Pago ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-5 w-5 text-blue-500" />
            Mercado Pago
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                mpConfigured ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {mpConfigured ? "Conectado" : "Pendente"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-500">
            Gere links e QR codes de pagamento diretamente dos pedidos.
          </p>

          {/* Feedback OAuth */}
          {oauthMsg && (
            <div
              className={`mb-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
                oauthMsg.type === "success"
                  ? "border border-green-200 bg-green-50 text-green-700"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {oauthMsg.type === "success"
                ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{oauthMsg.text}</span>
            </div>
          )}

          {/* ── Conta conectada ── */}
          {mpConfigured && (
            <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
                    {mpAccountLoading
                      ? <Loader2 className="h-5 w-5 animate-spin text-green-600" />
                      : <User className="h-5 w-5 text-green-600" />
                    }
                  </div>
                  <div>
                    {mpAccountLoading ? (
                      <p className="text-sm text-green-700">Carregando dados da conta...</p>
                    ) : mpAccount ? (
                      <>
                        <p className="text-sm font-semibold text-green-800">
                          {mpAccount.fullName ?? mpAccount.nickname ?? "Conta conectada"}
                        </p>
                        {mpAccount.email && (
                          <p className="text-xs text-green-600">{mpAccount.email}</p>
                        )}
                        {mpAccount.nickname && mpAccount.nickname !== mpAccount.fullName && (
                          <p className="text-xs text-green-500">@{mpAccount.nickname}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-green-800">Conta conectada</p>
                    )}
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      Mercado Pago ativo
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={disconnectMp}
                  disabled={disconnecting}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                >
                  {disconnecting
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <LogOut className="h-3.5 w-3.5" />
                  }
                  {disconnecting ? "Desconectando..." : "Desconectar"}
                </button>
              </div>
            </div>
          )}

          {/* Botão OAuth */}
          <a
            href="/api/auth/mercadopago"
            className="mb-5 flex items-center gap-3 rounded-lg border border-[#009EE3]/30 bg-[#009EE3]/5 px-4 py-3 transition hover:bg-[#009EE3]/10"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#009EE3]/15">
              <Link2 className="h-4 w-4 text-[#009EE3]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">
                {mpConfigured ? "Reconectar Mercado Pago" : "Conectar Mercado Pago"}
              </p>
              <p className="text-xs text-gray-400">
                {mpConfigured
                  ? "Clique para renovar a autorização OAuth"
                  : "Autorize com um clique, sem precisar copiar chaves"}
              </p>
            </div>
            <span className="rounded-lg bg-[#009EE3] px-3 py-1.5 text-xs font-semibold text-white">
              {mpConfigured ? "Reconectar" : "Conectar"}
            </span>
          </a>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-gray-400">ou configure manualmente</span>
            </div>
          </div>

          <form onSubmit={saveMp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mpPublicKey">Public Key</Label>
              <Input
                id="mpPublicKey"
                placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={mpPublicKey}
                onChange={(e) => setMpPublicKey(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-gray-400">Usada no frontend para inicializar o Checkout Pro.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mpAccessToken">Access Token</Label>
              <div className="relative">
                <Input
                  id="mpAccessToken"
                  type={showMpToken ? "text" : "password"}
                  placeholder="APP_USR-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={mpAccessToken}
                  onChange={(e) => setMpAccessToken(e.target.value)}
                  autoComplete="off"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowMpToken(!showMpToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showMpToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400">Chave secreta para criar preferências de pagamento.</p>
            </div>
            {errorMp && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{errorMp}</p>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loadingMp}>
                {loadingMp ? "Salvando..." : "Salvar credenciais"}
              </Button>
              {successMp && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Salvo com sucesso!
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Integração SEFAZ ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5 text-green-600" />
            Integração SEFAZ
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                nfeConfigured ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {nfeConfigured ? "Configurado" : "Pendente"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveNfe} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="focusNfeToken">Token da API</Label>
              <div className="relative">
                <Input
                  id="focusNfeToken"
                  type={showNfeToken ? "text" : "password"}
                  placeholder="Seu token da Focus NF-e"
                  value={focusNfeToken}
                  onChange={(e) => setFocusNfeToken(e.target.value)}
                  autoComplete="off"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNfeToken(!showNfeToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNfeToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nfeAmbiente">Ambiente</Label>
              <select
                id="nfeAmbiente"
                value={nfeAmbiente}
                onChange={(e) => setNfeAmbiente(e.target.value)}
                className={selectClass}
              >
                <option value="homologacao">Homologação (testes)</option>
                <option value="producao">Produção</option>
              </select>
              <p className="text-xs text-gray-400">
                Use homologação para testar sem emitir notas reais.
              </p>
            </div>

            {errorNfe && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{errorNfe}</p>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loadingNfe}>
                {loadingNfe ? "Salvando..." : "Salvar configuração NF-e"}
              </Button>
              {successNfe && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Salvo com sucesso!
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
