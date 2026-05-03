import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TenantLayoutClient } from "@/components/layout/tenant-layout-client";

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  let tenantName: string | undefined;
  let tenantLogoUrl: string | null = null;
  if (session.user.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { name: true, lojaLogoUrl: true },
    });
    tenantName = tenant?.name;
    tenantLogoUrl = tenant?.lojaLogoUrl ?? null;
  }

  return (
    <TenantLayoutClient
      role={session.user.role}
      tenantName={tenantName}
      logoUrl={tenantLogoUrl}
      userName={session.user.name}
    >
      {children}
    </TenantLayoutClient>
  );
}
