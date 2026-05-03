import type { Role } from "@/app/generated/prisma/client";
import "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
    tenantId: string | null;
    tenantSlug: string | null;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: Role;
      tenantId: string | null;
      tenantSlug: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    tenantId: string | null;
    tenantSlug: string | null;
  }
}
