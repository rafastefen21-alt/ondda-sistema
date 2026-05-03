import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Users, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

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
        <Link href="/clientes/novo">
          <Button>
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        </Link>
      </div>

      {clients.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Link key={client.id} href={`/clientes/${client.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                      <Users className="h-5 w-5 text-blue-800" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">
                        {client.name ?? "Sem nome"}
                      </p>
                      <p className="truncate text-sm text-gray-400">{client.email}</p>
                    </div>
                    <Badge variant={client.active ? "success" : "secondary"}>
                      {client.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-sm text-gray-500">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>{client._count.orders} pedido(s)</span>
                    <span className="ml-auto text-xs text-gray-400">
                      desde {formatDate(client.createdAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
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
