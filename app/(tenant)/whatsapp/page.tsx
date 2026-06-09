import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { WhatsAppClient } from "./whatsapp-client";

export const metadata = { title: "Disparos WhatsApp" };

export default async function WhatsAppPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "SUPER_ADMIN", "GERENTE"].includes(role)) redirect("/dashboard");

  const [tenant, clients] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { zapiInstanceId: true, zapiToken: true },
    }),
    prisma.user.findMany({
      where: { tenantId, role: "CLIENTE" },
      select: {
        id: true,
        name: true,
        nomeFantasia: true,
        phone: true,
        active: true,
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
  ]);

  const zapiConfigured = !!(tenant?.zapiInstanceId && tenant?.zapiToken);

  return (
    <WhatsAppClient
      zapiConfigured={zapiConfigured}
      clients={clients.map((c) => ({
        id:           c.id,
        name:         c.name ?? "",
        nomeFantasia: c.nomeFantasia ?? null,
        phone:        c.phone ?? null,
        active:       c.active,
      }))}
    />
  );
}
