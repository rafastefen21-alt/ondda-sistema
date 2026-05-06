"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
             "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC",
             "SP","SE","TO"];

const selectClass =
  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2";

type ClienteData = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  cnpj?: string | null;
  cpf?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  city?: string | null;
  state?: string | null;
  codigoCidade?: string | null;
  financeiroNome?: string | null;
  financeiroEmail?: string | null;
  financeiroPhone?: string | null;
  decisorNome?: string | null;
  decisorEmail?: string | null;
  decisorPhone?: string | null;
  observacoes?: string | null;
  active?: boolean;
};

export function ClienteForm({
  client,
  mode,
}: {
  client?: ClienteData;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [cep,        setCep]        = useState(client?.cep ?? "");
  const [logradouro, setLogradouro] = useState(client?.logradouro ?? "");
  const [bairro,     setBairro]     = useState(client?.bairro ?? "");
  const [city,       setCity]       = useState(client?.city ?? "");
  const [state,      setState]      = useState(client?.state ?? "");
  const [codigoCidade, setCodigoCidade] = useState(client?.codigoCidade ?? "");
  const [cepLoading, setCepLoading] = useState(false);

  function maskCep(raw: string): string {
    const d = raw.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  }

  async function buscarCep(value: string) {
    const masked = maskCep(value);
    const d = masked.replace(/\D/g, "");
    setCep(masked);
    if (d.length !== 8) return;
    setCepLoading(true);
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setLogradouro(data.logradouro ?? "");
        setBairro(data.bairro ?? "");
        setCity(data.localidade ?? "");
        setState(data.uf ?? "");
        setCodigoCidade(data.ibge ?? "");
      }
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      name:         fd.get("name"),
      email:        fd.get("email"),
      phone:        fd.get("phone")   || null,
      cnpj:         fd.get("cnpj")    || null,
      cpf:          fd.get("cpf")     || null,
      cep:          cep               || null,
      logradouro:   logradouro        || null,
      numero:       fd.get("numero")  || null,
      complemento:  fd.get("complemento") || null,
      bairro:       bairro            || null,
      city:         city              || null,
      state:        state             || null,
      codigoCidade: codigoCidade      || null,
      financeiroNome:  fd.get("financeiroNome")  || null,
      financeiroEmail: fd.get("financeiroEmail") || null,
      financeiroPhone: fd.get("financeiroPhone") || null,
      decisorNome:     fd.get("decisorNome")     || null,
      decisorEmail:    fd.get("decisorEmail")    || null,
      decisorPhone:    fd.get("decisorPhone")    || null,
      observacoes:     fd.get("observacoes")     || null,
    };

    if (mode === "create") {
      body.password = fd.get("password");
    } else {
      const pw = fd.get("password") as string;
      if (pw) body.password = pw;
      const activeVal = fd.get("active");
      if (activeVal !== null) body.active = activeVal === "true";
    }

    const url    = mode === "create" ? "/api/clientes" : `/api/clientes/${client!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erro ao salvar cliente.");
      return;
    }

    router.push("/clientes");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/clientes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === "create" ? "Novo Cliente" : "Editar Cliente"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Acesso ao sistema ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acesso ao sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="name">Nome / Razão Social *</Label>
                <Input
                  id="name" name="name"
                  defaultValue={client?.name}
                  placeholder="Ex: Padaria Boa Sorte"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email" name="email" type="email"
                  defaultValue={client?.email}
                  placeholder="contato@padaria.com.br"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefone principal</Label>
                <Input
                  id="phone" name="phone"
                  defaultValue={client?.phone ?? ""}
                  placeholder="(11) 99999-0000"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="password">
                  {mode === "create" ? "Senha de acesso *" : "Nova senha"}
                </Label>
                <Input
                  id="password" name="password" type="password"
                  placeholder={mode === "create" ? "Mínimo 6 caracteres" : "Deixe em branco para manter a atual"}
                  minLength={6}
                  required={mode === "create"}
                />
              </div>
            </div>

            {mode === "edit" && (
              <div className="space-y-1.5">
                <Label htmlFor="active">Status</Label>
                <select
                  id="active" name="active"
                  defaultValue={client?.active !== false ? "true" : "false"}
                  className={selectClass}
                >
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Contato financeiro ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Contato Financeiro
              <span className="ml-2 text-sm font-normal text-gray-400">(responsável por pagamentos)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label htmlFor="financeiroNome">Nome</Label>
                <Input
                  id="financeiroNome" name="financeiroNome"
                  defaultValue={client?.financeiroNome ?? ""}
                  placeholder="Ex: Maria Silva"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="financeiroPhone">Telefone / WhatsApp</Label>
                <Input
                  id="financeiroPhone" name="financeiroPhone"
                  defaultValue={client?.financeiroPhone ?? ""}
                  placeholder="(11) 99999-0000"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="financeiroEmail">Email</Label>
                <Input
                  id="financeiroEmail" name="financeiroEmail" type="email"
                  defaultValue={client?.financeiroEmail ?? ""}
                  placeholder="financeiro@padaria.com.br"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Tomador de decisão ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Tomador de Decisão
              <span className="ml-2 text-sm font-normal text-gray-400">(proprietário / diretor)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label htmlFor="decisorNome">Nome</Label>
                <Input
                  id="decisorNome" name="decisorNome"
                  defaultValue={client?.decisorNome ?? ""}
                  placeholder="Ex: João Pereira"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="decisorPhone">Telefone / WhatsApp</Label>
                <Input
                  id="decisorPhone" name="decisorPhone"
                  defaultValue={client?.decisorPhone ?? ""}
                  placeholder="(11) 99999-0000"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="decisorEmail">Email</Label>
                <Input
                  id="decisorEmail" name="decisorEmail" type="email"
                  defaultValue={client?.decisorEmail ?? ""}
                  placeholder="joao@padaria.com.br"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Dados fiscais ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Dados Fiscais
              <span className="ml-2 text-sm font-normal text-gray-400">(para NF-e)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" name="cnpj" defaultValue={client?.cnpj ?? ""} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" name="cpf" defaultValue={client?.cpf ?? ""} placeholder="000.000.000-00" />
                <p className="text-xs text-gray-400">Preencha CNPJ ou CPF.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cep">CEP</Label>
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
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">...</span>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="logradouro">Logradouro</Label>
                <Input id="logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} placeholder="Rua, Avenida..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="numero">Número</Label>
                <Input id="numero" name="numero" defaultValue={client?.numero ?? ""} placeholder="123" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input id="complemento" name="complemento" defaultValue={client?.complemento ?? ""} placeholder="Apto, Sala..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bairro">Bairro</Label>
                <Input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Centro" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">Município</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="São Paulo" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">UF</Label>
                <select
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className={selectClass}
                >
                  <option value="">UF</option>
                  {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Observações ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações internas</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              id="observacoes"
              name="observacoes"
              defaultValue={client?.observacoes ?? ""}
              placeholder="Notas internas sobre este cliente (não visível para ele)"
              rows={3}
              className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
            />
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <div className="flex gap-3">
          <Link href="/clientes" className="flex-1">
            <Button type="button" variant="outline" className="w-full">Cancelar</Button>
          </Link>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? "Salvando..." : mode === "create" ? "Cadastrar" : "Salvar Alterações"}
          </Button>
        </div>
      </form>
    </div>
  );
}
