import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(num);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  RASCUNHO: "Rascunho",
  PENDENTE_APROVACAO: "Aguardando Aprovação",
  APROVADO: "Aprovado",
  EM_PRODUCAO: "Em Produção",
  PRONTO: "Pronto",
  EM_ENTREGA: "Em Entrega",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  RASCUNHO: "bg-gray-100 text-gray-600",
  PENDENTE_APROVACAO: "bg-yellow-100 text-yellow-700",
  APROVADO: "bg-blue-100 text-blue-700",
  EM_PRODUCAO: "bg-cyan-100 text-cyan-700",
  PRONTO: "bg-purple-100 text-purple-700",
  EM_ENTREGA: "bg-indigo-100 text-indigo-700",
  ENTREGUE: "bg-green-100 text-green-700",
  CANCELADO: "bg-red-100 text-red-700",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CARTAO_CREDITO: "Cartão de Crédito",
  CARTAO_DEBITO: "Cartão de Débito",
  DINHEIRO: "Dinheiro",
  TRANSFERENCIA: "Transferência",
};

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  TENANT_ADMIN: "Administrador",
  GERENTE: "Gerente",
  OPERADOR: "Operador",
  CLIENTE: "Cliente",
};

// Returns true if the user can see prices for this order status
export function canSeePrice(role: string, status: string): boolean {
  if (["SUPER_ADMIN", "TENANT_ADMIN", "GERENTE", "OPERADOR"].includes(role)) {
    return true;
  }
  const visibleStatuses = [
    "APROVADO",
    "EM_PRODUCAO",
    "PRONTO",
    "EM_ENTREGA",
    "ENTREGUE",
  ];
  return visibleStatuses.includes(status);
}
