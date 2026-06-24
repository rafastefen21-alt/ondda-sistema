import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NotasClient } from "./notas-client";

export default async function NotasPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(role)) {
    redirect("/dashboard");
  }

  const invoices = await prisma.invoice.findMany({
    where: { tenantId },
    include: {
      order: {
        include: {
          client: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const items = invoices.map((inv) => ({
    id:          inv.id,
    status:      inv.status as "EMITIDA" | "PROCESSANDO" | "ERRO" | "CANCELADA",
    number:      inv.number ?? null,
    accessKey:   inv.accessKey ?? null,
    focusNfeRef: inv.focusNfeRef ?? null,
    pdfUrl:      inv.pdfUrl ?? null,
    issuedAt:    inv.issuedAt ? inv.issuedAt.toISOString() : null,
    createdAt:   inv.createdAt.toISOString(),
    errorMsg:    inv.errorMsg ?? null,
    orderId:     inv.orderId,
    clientName:  inv.order.client?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notas Fiscais</h1>
          <p className="text-gray-500">{invoices.length} nota(s)</p>
        </div>
      </div>

      <NotasClient invoices={items} />

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-800" />
            <div className="text-sm text-blue-900">
              <p className="font-medium">Integração SEFAZ</p>
              <p className="mt-1">
                Para emitir NF-e, configure seu token SEFAZ e CNPJ em{" "}
                <Link href="/configuracoes" className="font-medium underline">
                  Configurações
                </Link>
                . A emissão é feita a partir da página de cada pedido aprovado.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
