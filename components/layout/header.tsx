"use client";

import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/utils";
import type { Role } from "@/app/generated/prisma/client";

interface HeaderProps {
  userName?: string | null;
  role: Role;
  onMenuClick?: () => void;
}

export function Header({ userName, role, onMenuClick }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5 text-gray-500" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-900">
            {userName?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-gray-900">{userName}</p>
            <p className="text-xs text-gray-500">{ROLE_LABELS[role]}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
