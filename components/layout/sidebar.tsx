"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  CheckSquare,
  Factory,
  DollarSign,
  FileText,
  Users,
  Settings,
  Building2,
  LogOut,
  Building,
  Plug,
  Store,
  ChevronDown,
  HelpCircle,
  Warehouse,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { Role } from "@/app/generated/prisma/client";

interface SubItem {
  href: string;
  label: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
  children?: SubItem[];
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "TENANT_ADMIN", "GERENTE", "OPERADOR", "CLIENTE"],
  },
  {
    href: "/pedidos",
    label: "Meus Pedidos",
    icon: ShoppingCart,
    roles: ["CLIENTE"],
  },
  {
    href: "/catalogo",
    label: "Catálogo",
    icon: Package,
    roles: ["CLIENTE"],
  },
  {
    href: "/pedidos",
    label: "Pedidos",
    icon: ShoppingCart,
    roles: ["TENANT_ADMIN", "GERENTE", "OPERADOR"],
  },
  {
    href: "/aprovacoes",
    label: "Aprovações",
    icon: CheckSquare,
    roles: ["TENANT_ADMIN", "GERENTE"],
  },
  {
    href: "/producao",
    label: "Produção",
    icon: Factory,
    roles: ["TENANT_ADMIN", "GERENTE", "OPERADOR"],
  },
  {
    href: "/produtos",
    label: "Produtos",
    icon: Package,
    roles: ["TENANT_ADMIN", "GERENTE"],
  },
  {
    href: "/clientes",
    label: "Clientes",
    icon: Users,
    roles: ["TENANT_ADMIN", "GERENTE"],
  },
  {
    href: "/estoque",
    label: "Estoque",
    icon: Warehouse,
    roles: ["TENANT_ADMIN", "GERENTE"],
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    icon: DollarSign,
    roles: ["TENANT_ADMIN", "GERENTE"],
  },
  {
    href: "/notas",
    label: "Notas Fiscais",
    icon: FileText,
    roles: ["TENANT_ADMIN", "GERENTE"],
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    roles: ["TENANT_ADMIN"],
    children: [
      { href: "/configuracoes#dados-fiscais", label: "Dados Fiscais" },
      { href: "/configuracoes#integracoes",   label: "Integrações" },
      { href: "/configuracoes#usuarios",      label: "Usuários" },
      { href: "/configuracoes#loja-online",   label: "Loja Online" },
    ],
  },
  {
    href: "/ajuda",
    label: "Ajuda",
    icon: HelpCircle,
    roles: ["SUPER_ADMIN", "TENANT_ADMIN", "GERENTE", "OPERADOR", "CLIENTE"],
  },
  {
    href: "/admin",
    label: "Admin Geral",
    icon: Building2,
    roles: ["SUPER_ADMIN"],
  },
];

interface SidebarProps {
  role: Role;
  tenantName?: string;
  logoUrl?: string | null;
}

export function Sidebar({ role, tenantName, logoUrl }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="flex h-full w-64 flex-col bg-gray-900 text-white overflow-y-auto">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-gray-700 px-5">
        {logoUrl ? (
          <>
            <Image
              src={logoUrl}
              alt={tenantName ?? "Logo"}
              width={32}
              height={32}
              className="h-8 w-8 flex-shrink-0 rounded-md object-contain"
            />
            <p className="truncate text-sm font-bold text-white">
              {tenantName ?? ""}
            </p>
          </>
        ) : (
          <>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-blue-800">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {tenantName ?? "Ondda"}
              </p>
              <p className="text-xs text-gray-400">Sistema de Pedidos</p>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const hasChildren = item.children && item.children.length > 0;

            return (
              <li key={`${item.href}-${item.label}`}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-800 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {hasChildren && (
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 flex-shrink-0 transition-transform",
                        isActive ? "rotate-0 text-white/80" : "text-gray-500"
                      )}
                    />
                  )}
                </Link>

                {/* Sub-items — visíveis quando o pai está ativo */}
                {hasChildren && isActive && (
                  <ul className="mt-1 ml-3 space-y-0.5 border-l border-gray-700 pl-3">
                    {item.children!.map((child) => {
                      const childActive = pathname + (typeof window !== "undefined" ? window.location.hash : "") === child.href
                        || child.href === "/configuracoes#dados-fiscais"; // primeiro item sempre destacado por padrão

                      return (
                        <li key={child.href}>
                          <a
                            href={child.href}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                          >
                            <span className="h-1 w-1 flex-shrink-0 rounded-full bg-gray-600" />
                            {child.label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sign out */}
      <div className="border-t border-gray-700 p-4">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
