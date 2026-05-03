"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClass =
  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COST_CATEGORIES = [
  "MATERIA_PRIMA",
  "EMBALAGEM",
  "COMBUSTIVEL",
  "ENERGIA",
  "ALUGUEL",
  "FOLHA_PAGAMENTO",
  "MANUTENCAO",
  "OUTRO",
];

const CATEGORY_LABELS: Record<string, string> = {
  MATERIA_PRIMA: "Matéria-prima",
  EMBALAGEM: "Embalagem",
  COMBUSTIVEL: "Combustível",
  ENERGIA: "Energia elétrica",
  ALUGUEL: "Aluguel",
  FOLHA_PAGAMENTO: "Folha de pagamento",
  MANUTENCAO: "Manutenção",
  OUTRO: "Outro",
};

export default function NovoCustoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const body = {
      description: fd.get("description") as string,
      amount: parseFloat(fd.get("amount") as string),
      category: fd.get("category") as string,
      date: fd.get("date") as string,
      recurring: fd.get("recurring") === "true",
      notes: (fd.get("notes") as string) || undefined,
    };

    const res = await fetch("/api/custos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erro ao registrar custo.");
      return;
    }

    router.push("/financeiro");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/financeiro">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Registrar Custo</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do custo operacional</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição *</Label>
              <Input
                id="description"
                name="description"
                placeholder="Ex: Farinha de trigo – Fornecedor ABC"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Valor (R$) *</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="date">Data *</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={today}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category">Categoria *</Label>
              <select id="category" name="category" required className={selectClass}>
                {COST_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="recurring">Recorrente?</Label>
              <select id="recurring" name="recurring" className={selectClass}>
                <option value="false">Não – lançamento único</option>
                <option value="true">Sim – custo fixo mensal</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Informações adicionais (opcional)"
                rows={2}
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Link href="/financeiro" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Salvando..." : "Registrar Custo"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
