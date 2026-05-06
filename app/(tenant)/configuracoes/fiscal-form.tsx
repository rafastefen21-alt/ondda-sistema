"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Building2, AlertCircle } from "lucide-react";

const selectClass =
  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2";

interface FiscalData {
  // já existentes no tenant
  cnpj:            string | null;
  ie:              string | null;
  im:              string | null;
  cnae:            string | null;
  regimeTributario: string | null;
  // endereço estruturado
  cep:             string | null;
  logradouro:      string | null;
  numero:          string | null;
  complemento:     string | null;
  bairro:          string | null;
  city:            string | null;
  state:           string | null;
  codigoCidade:    string | null;
  // contato
  phone:           string | null;
}

interface Props {
  initial: FiscalData;
}

export function FiscalForm({ initial }: Props) {
  const router = useRouter();

  const [cnpj,             setCnpj]             = useState(initial.cnpj             ?? "");
  const [ie,               setIe]               = useState(initial.ie               ?? "");
  const [im,               setIm]               = useState(initial.im               ?? "");
  const [cnae,             setCnae]             = useState(initial.cnae             ?? "");
  const [regimeTributario, setRegimeTributario] = useState(initial.regimeTributario ?? "");
  const [cep,              setCep]              = useState(initial.cep              ?? "");
  const [logradouro,       setLogradouro]       = useState(initial.logradouro       ?? "");
  const [numero,           setNumero]           = useState(initial.numero           ?? "");
  const [complemento,      setComplemento]      = useState(initial.complemento      ?? "");
  const [bairro,           setBairro]           = useState(initial.bairro           ?? "");
  const [city,             setCity]             = useState(initial.city             ?? "");
  const [state,            setState]            = useState(initial.state            ?? "");
  const [codigoCidade,     setCodigoCidade]     = useState(initial.codigoCidade     ?? "");
  const [phone,            setPhone]            = useState(initial.phone            ?? "");

  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState("");
  const [cepLoading, setCepLoading] = useState(false);

  /** Aplica máscara 00000-000 e limita a 8 dígitos */
  function maskCep(raw: string): string {
    const d = raw.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  }

  // Preenchimento automático pelo CEP (ViaCEP)
  async function buscarCep(value: string) {
    const masked = maskCep(value);
    const digits = masked.replace(/\D/g, "");
    setCep(masked);
    if (digits.length !== 8) return;

    setCepLoading(true);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setLogradouro(data.logradouro ?? "");
        setBairro(data.bairro ?? "");
        setCity(data.localidade ?? "");
        setState(data.uf ?? "");
        setCodigoCidade(data.ibge ?? "");
      }
    } catch {
      // silencia erro de rede — usuário preenche manualmente
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const res = await fetch("/api/configuracoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cnpj:             cnpj             || null,
        ie:               ie               || null,
        im:               im               || null,
        cnae:             cnae             || null,
        regimeTributario: regimeTributario || null,
        cep:              cep              || null,
        logradouro:       logradouro       || null,
        numero:           numero           || null,
        complemento:      complemento      || null,
        bairro:           bairro           || null,
        city:             city             || null,
        state:            state            || null,
        codigoCidade:     codigoCidade     || null,
        phone:            phone            || null,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Erro ao salvar dados fiscais.");
    } else {
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    }
  }

  const isComplete = !!(
    cnpj && ie && cnae && regimeTributario &&
    cep && logradouro && numero && bairro && city && state && codigoCidade
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-5 w-5 text-green-600" />
          Dados Fiscais da Empresa
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
              isComplete
                ? "bg-green-100 text-green-700"
                : "bg-blue-100 text-blue-900"
            }`}
          >
            {isComplete ? "Completo" : "Incompleto"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!isComplete && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Preencha todos os campos obrigatórios para habilitar a emissão de NF-e.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ── Identificação ── */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Identificação
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cnpj">CNPJ *</Label>
                <Input
                  id="cnpj"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ie">Inscrição Estadual (IE) *</Label>
                <Input
                  id="ie"
                  value={ie}
                  onChange={(e) => setIe(e.target.value)}
                  placeholder="Ex: 123.456.789.110"
                />
                <p className="text-xs text-gray-400">Use "ISENTO" se não tiver IE.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="im">Inscrição Municipal (IM)</Label>
                <Input
                  id="im"
                  value={im}
                  onChange={(e) => setIm(e.target.value)}
                  placeholder="Ex: 12345678"
                />
                <p className="text-xs text-gray-400">Necessária para emissão de NFS-e.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cnae">CNAE *</Label>
                <Input
                  id="cnae"
                  value={cnae}
                  onChange={(e) => setCnae(e.target.value)}
                  placeholder="Ex: 1091-1/01"
                  maxLength={10}
                />
                <p className="text-xs text-gray-400">
                  Consulte em{" "}
                  <a
                    href="https://www.ibge.gov.br/explica/codigos-dos-municipios.php"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-800 underline"
                  >
                    cnae.ibge.gov.br
                  </a>
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="regimeTributario">Regime Tributário *</Label>
                <select
                  id="regimeTributario"
                  value={regimeTributario}
                  onChange={(e) => setRegimeTributario(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Selecione...</option>
                  <option value="1">1 — Simples Nacional</option>
                  <option value="2">2 — Simples Nacional (Excesso)</option>
                  <option value="3">3 — Regime Normal (Lucro Presumido / Real)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  maxLength={20}
                />
              </div>
            </div>
          </div>

          {/* ── Endereço ── */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Endereço (para NF-e)
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="cep">CEP *</Label>
                <div className="relative">
                  <Input
                    id="cep"
                    value={cep}
                    onChange={(e) => buscarCep(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className={
                      cep && cep.replace(/\D/g, "").length !== 8
                        ? "border-red-400 focus:ring-red-400"
                        : ""
                    }
                  />
                  {cepLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      buscando...
                    </span>
                  )}
                </div>
                {cep && cep.replace(/\D/g, "").length !== 8 && (
                  <p className="text-xs text-red-500">CEP deve ter 8 dígitos (ex: 03342-000)</p>
                )}
                {(!cep || cep.replace(/\D/g, "").length === 8) && (
                  <p className="text-xs text-gray-400">Preenchimento automático.</p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="logradouro">Logradouro *</Label>
                <Input
                  id="logradouro"
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                  placeholder="Rua, Avenida..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="numero">Número *</Label>
                <Input
                  id="numero"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Ex: 123"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="complemento">Complemento</Label>
                <Input
                  id="complemento"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  placeholder="Apto, Sala..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bairro">Bairro *</Label>
                <Input
                  id="bairro"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  placeholder="Ex: Centro"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="city">Município *</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: São Paulo"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">UF *</Label>
                <select
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className={selectClass}
                >
                  <option value="">UF</option>
                  {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
                    "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC",
                    "SP","SE","TO"].map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="codigoCidade">Código IBGE do Município *</Label>
                <Input
                  id="codigoCidade"
                  value={codigoCidade}
                  onChange={(e) => setCodigoCidade(e.target.value)}
                  placeholder="Ex: 3550308"
                  maxLength={7}
                />
                <p className="text-xs text-gray-400">
                  Preenchido automaticamente pelo CEP. Consulte em{" "}
                  <a
                    href="https://www.ibge.gov.br/explica/codigos-dos-municipios.php"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-800 underline"
                  >
                    ibge.gov.br
                  </a>
                </p>
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar dados fiscais"}
            </Button>
            {success && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                Salvo com sucesso!
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
