"use client";

import { useState } from "react";
import { Users, Plus, Shield, Wrench, UserCog, X, Check, ToggleLeft, ToggleRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/utils";

const selectClass =
  "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2";

type Role = "TENANT_ADMIN" | "GERENTE" | "OPERADOR";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

const ROLE_ICONS: Record<Role, React.ReactNode> = {
  TENANT_ADMIN: <Shield className="h-3.5 w-3.5" />,
  GERENTE:      <UserCog className="h-3.5 w-3.5" />,
  OPERADOR:     <Wrench className="h-3.5 w-3.5" />,
};

const ROLE_COLORS: Record<Role, string> = {
  TENANT_ADMIN: "bg-blue-100 text-blue-900",
  GERENTE:      "bg-blue-100 text-blue-700",
  OPERADOR:     "bg-gray-100 text-gray-700",
};

const ROLE_DESC: Record<Role, string> = {
  TENANT_ADMIN: "Acesso total ao sistema",
  GERENTE:      "Aprova pedidos, vê financeiro e produção",
  OPERADOR:     "Move pedidos em produção/entrega",
};

export function UsuariosManager({ initial, currentUserId }: { initial: User[]; currentUserId: string }) {
  const [users, setUsers] = useState<User[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "GERENTE" as Role });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Erro ao criar usuário.");
      return;
    }

    const newUser = await res.json();
    setUsers((prev) => [...prev, newUser]);
    setShowForm(false);
    setForm({ name: "", email: "", password: "", role: "GERENTE" });
  }

  async function handleRoleChange(userId: string, role: Role) {
    const prev = users.find((u) => u.id === userId);
    setUsers((all) => all.map((u) => (u.id === userId ? { ...u, role } : u)));

    const res = await fetch(`/api/usuarios/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (!res.ok) {
      setUsers((all) => all.map((u) => (u.id === userId ? { ...u, role: prev!.role } : u)));
    }
  }

  async function handleToggleActive(userId: string, active: boolean) {
    setUsers((all) => all.map((u) => (u.id === userId ? { ...u, active } : u)));

    const res = await fetch(`/api/usuarios/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });

    if (!res.ok) {
      setUsers((all) => all.map((u) => (u.id === userId ? { ...u, active: !active } : u)));
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-700" />
            Usuários Internos
          </CardTitle>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancelar" : "Novo usuário"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Role legend */}
        <div className="grid gap-2 rounded-lg bg-gray-50 p-3 sm:grid-cols-3">
          {(["TENANT_ADMIN", "GERENTE", "OPERADOR"] as Role[]).map((r) => (
            <div key={r} className="flex items-start gap-2">
              <span className={`mt-0.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[r]}`}>
                {ROLE_ICONS[r]}
                {ROLE_LABELS[r]}
              </span>
              <p className="text-xs text-gray-400">{ROLE_DESC[r]}</p>
            </div>
          ))}
        </div>

        {/* Create form */}
        {showForm && (
          <form onSubmit={handleCreate} className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-900">Novo usuário interno</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="u-name">Nome *</Label>
                <Input
                  id="u-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Carlos Silva"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-email">Email *</Label>
                <Input
                  id="u-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="carlos@casadopao.com.br"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-password">Senha inicial *</Label>
                <Input
                  id="u-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-role">Função *</Label>
                <select
                  id="u-role"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                  className={selectClass}
                >
                  <option value="GERENTE">Gerente</option>
                  <option value="OPERADOR">Operador</option>
                  <option value="TENANT_ADMIN">Administrador</option>
                </select>
              </div>
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" disabled={loading}>
              <Check className="h-4 w-4" />
              {loading ? "Criando..." : "Criar usuário"}
            </Button>
          </form>
        )}

        {/* User list */}
        <div className="divide-y divide-gray-100">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            return (
              <div key={user.id} className={`flex items-center gap-3 py-3 ${!user.active ? "opacity-50" : ""}`}>
                {/* Avatar */}
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-900">
                  {user.name?.charAt(0).toUpperCase() ?? "U"}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
                    {isSelf && (
                      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">você</span>
                    )}
                    {!user.active && (
                      <Badge variant="secondary" className="text-xs">Inativo</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-gray-400">{user.email}</p>
                </div>

                {/* Role selector */}
                <select
                  value={user.role}
                  disabled={isSelf}
                  onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                  className={`rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-700 disabled:cursor-not-allowed disabled:opacity-60 ${ROLE_COLORS[user.role]}`}
                >
                  <option value="TENANT_ADMIN">Administrador</option>
                  <option value="GERENTE">Gerente</option>
                  <option value="OPERADOR">Operador</option>
                </select>

                {/* Active toggle */}
                <button
                  disabled={isSelf}
                  onClick={() => handleToggleActive(user.id, !user.active)}
                  title={user.active ? "Desativar acesso" : "Ativar acesso"}
                  className="flex-shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {user.active
                    ? <ToggleRight className="h-5 w-5 text-green-500" />
                    : <ToggleLeft className="h-5 w-5" />
                  }
                </button>
              </div>
            );
          })}
          {users.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">Nenhum usuário interno cadastrado.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
