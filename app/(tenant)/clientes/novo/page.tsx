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

export default function NovoClientePage() {
  const router = useRouter();
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [cep,        setCep]        = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [bairro,     setBairro]     = useState("");
  const [city,       setCity]       = useState("");
  const [state,      setState]      = useState("");
  const [codigoCidade, setCodigoCidade] = useState("");
  const [cepLoading, setCepLoading] = useState(false);

  async function buscarCep(value: string) {
    const digits = value.replace(/\D/g, "");
    setCep(value);
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
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      name:         fd.get("name"),
      email:        fd.get("email"),
      password:     fd.get("password"),
      cnpj:         fd.get("cnpj")  || null,
      cpf:          fd.get("cpf")   || null,
      cep:          cep             || null,
      logradouro:   logradouro      || null,
      numero:       fd.get("numero") || null,
      complemento:  fd.get("complemento") || null,
      bairro:       bairro          || null,
      city:         city            || null,
      state:        state           || null,
      codigoCidade: codigoCidade    || null,
    };

    const res = await fetch("/api/clientes", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erro ao cadastrar cliente.");
      return;
    }

    router.push("/clientes");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/clientes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Novo Cliente</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Acesso ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acesso ao sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome / Razão Social *</Label>
              <Input id="name" name="name" placeholder="Ex: Padaria Boa Sorte" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" placeholder="contato@padaria.com.br" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha de acesso *</Label>
              <Input id="password" name="password" type="password" placeholder="Mínimo 6 caracteres" minLength={6} required />
            </div>
          </CardContent>
        </Card>

        {/* ── Dados fiscais ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Dados fiscais{" "}
              <span className="text-sm font-normal text-gray-400">(para NF-e)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" name="cnpj" placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" name="cpf" placeholder="000.000.000-00" />
                <p className="text-xs text-gray-400">Preencha um dos dois.</p>
              </div>
            </div>

            {/* Endereço com autopreenchimento via CEP */}
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
                  />
                  {cepLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      ...
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="logradouro">Logradouro</Label>
                <Input
                  id="logradouro"
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                  placeholder="Rua, Avenida..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="numero">Número</Label>
                <Input id="numero" name="numero" placeholder="123" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input id="complemento" name="complemento" placeholder="Apto, Sala..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  placeholder="Centro"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">Município</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="São Paulo"
                />
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

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <div className="flex gap-3">
          <Link href="/clientes" className="flex-1">
            <Button type="button" variant="outline" className="w-full">Cancelar</Button>
          </Link>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? "Cadastrando..." : "Cadastrar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
