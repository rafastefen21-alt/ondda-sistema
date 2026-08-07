"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, ShoppingBag, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export interface ClienteItem {
  id: string;
  name: string | null;
  nomeFantasia: string | null;
  email: string;
  cnpj: string | null;
  cpf: string | null;
  active: boolean;
  createdAt: string;
  ordersCount: number;
}

export function ClientesList({ clients }: { clients: ClienteItem[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const soDigitos = term.replace(/\D/g, "");

  const filtered = !term
    ? clients
    : clients.filter((c) => {
        const texto = [c.name, c.nomeFantasia, c.email].some((v) =>
          v?.toLowerCase().includes(term),
        );
        const doc = soDigitos.length >= 2 &&
          [c.cnpj, c.cpf].some((v) => v?.replace(/\D/g, "").includes(soDigitos));
        return texto || doc;
      });

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, fantasia, e-mail ou CNPJ/CPF..."
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
        />
      </div>

      {term && (
        <p className="text-xs text-gray-400">
          {filtered.length} de {clients.length} cliente(s)
        </p>
      )}

      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => (
            <Link key={client.id} href={`/clientes/${client.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                      <Users className="h-5 w-5 text-blue-800" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">
                        {client.nomeFantasia ?? client.name ?? "Sem nome"}
                      </p>
                      {client.nomeFantasia && (
                        <p className="truncate text-xs text-gray-400">{client.name}</p>
                      )}
                      <p className="truncate text-sm text-gray-400">{client.email}</p>
                    </div>
                    <Badge variant={client.active ? "success" : "secondary"}>
                      {client.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-sm text-gray-500">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>{client.ordersCount} pedido(s)</span>
                    <span className="ml-auto text-xs text-gray-400">
                      desde {formatDate(client.createdAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-16 text-gray-400">
          <Search className="mb-3 h-10 w-10 text-gray-200" />
          <p>Nenhum cliente encontrado para &quot;{q}&quot;.</p>
        </div>
      )}
    </div>
  );
}
