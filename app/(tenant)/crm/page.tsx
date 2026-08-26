import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CrmClient } from "./crm-client";

export default async function CrmPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(role)) redirect("/dashboard");

  const cardInclude = {
    client: { select: { id: true, name: true, nomeFantasia: true, email: true, phone: true } },
    waConversation: {
      select: { unreadCount: true, lastMessageText: true, lastMessageAt: true, lastDirection: true },
    },
  } as const;

  const [novosCards, posVendaCards, tenant] = await Promise.all([
    prisma.crmCard.findMany({
      where: { tenantId, tab: "NOVOS" },
      include: cardInclude,
      orderBy: [{ stage: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    }),
    prisma.crmCard.findMany({
      where: { tenantId, tab: "POS_VENDA" },
      include: cardInclude,
      orderBy: [{ stage: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { zapiInstanceId: true, zapiToken: true, slug: true },
    }),
  ]);

  const zapiConfigured = !!(tenant?.zapiInstanceId && tenant?.zapiToken);

  const serialize = (cards: typeof novosCards) =>
    cards.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      waConversation: c.waConversation
        ? {
            ...c.waConversation,
            lastMessageAt: c.waConversation.lastMessageAt
              ? c.waConversation.lastMessageAt.toISOString()
              : null,
          }
        : null,
    }));

  return (
    <CrmClient
      initialNovos={serialize(novosCards)}
      initialPosVenda={serialize(posVendaCards)}
      zapiConfigured={zapiConfigured}
      lojaSlug={tenant?.slug ?? ""}
    />
  );
}
