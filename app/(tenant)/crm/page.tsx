import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CrmClient } from "./crm-client";

export default async function CrmPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(role)) redirect("/dashboard");

  const [novosCards, posVendaCards, tenant] = await Promise.all([
    prisma.crmCard.findMany({
      where: { tenantId, tab: "NOVOS" },
      include: { client: { select: { id: true, name: true, nomeFantasia: true, email: true, phone: true } } },
      orderBy: [{ stage: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    }),
    prisma.crmCard.findMany({
      where: { tenantId, tab: "POS_VENDA" },
      include: { client: { select: { id: true, name: true, nomeFantasia: true, email: true, phone: true } } },
      orderBy: [{ stage: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { zapiInstanceId: true, zapiToken: true, slug: true },
    }),
  ]);

  const zapiConfigured = !!(tenant?.zapiInstanceId && tenant?.zapiToken);

  return (
    <CrmClient
      initialNovos={novosCards}
      initialPosVenda={posVendaCards}
      zapiConfigured={zapiConfigured}
      lojaSlug={tenant?.slug ?? ""}
    />
  );
}
