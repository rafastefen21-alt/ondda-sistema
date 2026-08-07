import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Users, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientesList } from "./clientes-list";

export default async function ClientesPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(role)) {
    redirect("/dashboard");
  }

  const clients = await prisma.user.findMany({
    where: { tenantId, role: "CLIENTE" },
    include: {
      _count: { select: { orders: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500">{clients.length} cliente(s) cadastrado(s)</p>
        </div>
        <div className="flex items-center gap-2">
          {clients.length > 0 && (
            <a href="/api/clientes/exportar">
              <Button variant="outline">
                <Download className="h-4 w-4" />
                Exportar Excel
              </Button>
            </a>
          )}
          <Link href="/clientes/novo">
            <Button>
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </Link>
        </div>
      </div>

      {clients.length > 0 ? (
        <ClientesList
          clients={clients.map((c) => ({
            id: c.id,
            name: c.name,
            nomeFantasia: c.nomeFantasia,
            email: c.email,
            cnpj: c.cnpj,
            cpf: c.cpf,
            active: c.active,
            createdAt: c.createdAt.toISOString(),
            ordersCount: c._count.orders,
          }))}
        />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-16">
          <Users className="mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">Nenhum cliente cadastrado.</p>
          <Link href="/clientes/novo" className="mt-3">
            <Button variant="outline">Cadastrar primeiro cliente</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
