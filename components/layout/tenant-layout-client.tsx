"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { LayoutDashboard, ShoppingCart, Package, HelpCircle, X } from "lucide-react";
import Link from "next/link";
import type { Role } from "@/app/generated/prisma/client";

interface Props {
  role: Role;
  tenantName?: string;
  logoUrl?: string | null;
  userName?: string | null;
  children: React.ReactNode;
}

const clientBottomNav = [
  { href: "/dashboard", label: "Início",   icon: LayoutDashboard },
  { href: "/catalogo",  label: "Catálogo", icon: Package },
  { href: "/pedidos",   label: "Pedidos",  icon: ShoppingCart },
  { href: "/ajuda",     label: "Ajuda",    icon: HelpCircle },
];

const internalBottomNav = [
  { href: "/dashboard", label: "Início",   icon: LayoutDashboard },
  { href: "/pedidos",   label: "Pedidos",  icon: ShoppingCart },
  { href: "/producao",  label: "Produção", icon: Package },
  { href: "/ajuda",     label: "Ajuda",    icon: HelpCircle },
];

export function TenantLayoutClient({ role, tenantName, logoUrl, userName, children }: Props) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isClient = role === "CLIENTE";
  const bottomNav = isClient ? clientBottomNav : internalBottomNav;

  // Fecha sidebar ao trocar de rota
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  return (
    <div className="flex h-full">

      {/* ── Sidebar desktop ── */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar role={role} tenantName={tenantName} logoUrl={logoUrl} />
      </div>

      {/* ── Sidebar drawer mobile ── */}
      {sidebarOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-gray-900 shadow-2xl lg:hidden">
            <div className="flex items-center justify-between border-b border-gray-700 px-5 py-4">
              <span className="text-sm font-bold text-white">{tenantName ?? "Ondda"}</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Reutiliza o sidebar sem height fixa */}
            <div className="flex-1 overflow-y-auto">
              <Sidebar role={role} tenantName={tenantName} logoUrl={logoUrl} />
            </div>
          </div>
        </>
      )}

      {/* ── Conteúdo principal ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userName={userName}
          role={role}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 pb-24 lg:p-6 lg:pb-6">
          {children}
        </main>
      </div>

      {/* ── Bottom nav mobile ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white lg:hidden">
        <div className="flex h-16 items-center justify-around px-2">
          {bottomNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-center transition-colors ${
                  active ? "text-blue-800" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span className="text-[10px] font-medium">{label}</span>
                {active && (
                  <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-blue-800" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
