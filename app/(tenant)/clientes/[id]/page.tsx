import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, ShoppingBag, Calendar,
  Pencil, User, DollarSign, Building2, FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatCurrency, formatDate,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
} from "@/lib/utils";

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(role)) redirect("/dashboard");

  const { id } = await params;

  const client = await prisma.user.findFirst({
    where: { id, tenantId, role: "CLIENTE" },
    include: {
      orders: {
        include: {
          items:    { include: { product: { select: { name: true } } } },
          payments: { select: { amount: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!client) notFound();

  const totalOrders  = client.orders.length;
  const totalRevenue = client.orders
    .flatMap((o) => o.payments)
    .filter((p) => p.status === "PAGO")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/clientes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          <p className="text-sm text-gray-500">Cliente desde {formatDate(client.createdAt)}</p>
        </div>
        <Badge variant={client.active ? "success" : "secondary"}>
          {client.active ? "Ativo" : "Inativo"}
        </Badge>
        <Link href={`/clientes/${id}/editar`}>
          <Button variant="outline" size="sm" className="gap-2">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        </Link>
      </div>

      {/* Métricas */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-400">Total de pedidos</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-400">Receita recebida</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-400">Último pedido</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {client.orders[0] ? formatDate(client.orders[0].createdAt) : "Nenhum pedido"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna esquerda — dados */}
        <div className="space-y-4 lg:col-span-1">

          {/* Contato principal */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-gray-400" />
                Dados da empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="text-gray-700 break-all">{client.email}</span>
              </div>
              {client.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="text-gray-700">{client.phone}</span>
                </div>
              )}
              {(client.cnpj || client.cpf) && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="text-gray-700">{client.cnpj ?? client.cpf}</span>
                </div>
              )}
              {client.city && (
                <p className="text-xs text-gray-400 pt-1">
                  {[client.logradouro, client.numero, client.bairro, client.city, client.state]
                    .filter(Boolean).join(", ")}
                </p>
              )}
              <div className="flex items-center gap-2 text-sm pt-1">
                <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="text-gray-400 text-xs">Atualizado em {formatDate(client.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Contato financeiro */}
          {(client.financeiroNome || client.financeiroEmail || client.financeiroPhone) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  Contato Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {client.financeiroNome && (
                  <p className="text-sm font-medium text-gray-800">{client.financeiroNome}</p>
                )}
                {client.financeiroPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="text-gray-700">{client.financeiroPhone}</span>
                  </div>
                )}
                {client.financeiroEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="text-gray-700 break-all">{client.financeiroEmail}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tomador de decisão */}
          {(client.decisorNome || client.decisorEmail || client.decisorPhone) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-gray-400" />
                  Tomador de Decisão
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {client.decisorNome && (
                  <p className="text-sm font-medium text-gray-800">{client.decisorNome}</p>
                )}
                {client.decisorPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="text-gray-700">{client.decisorPhone}</span>
                  </div>
                )}
                {client.decisorEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="text-gray-700 break-all">{client.decisorEmail}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Observações */}
          {client.observacoes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Observações internas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{client.observacoes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna direita — pedidos */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Pedidos recentes</h2>
          <div className="space-y-3">
            {client.orders.length > 0 ? (
              client.orders.map((order) => {
                const orderTotal = order.items.reduce(
                  (sum, item) => sum + Number(item.unitPrice) * Number(item.quantity),
                  0,
                );
                return (
                  <Link key={order.id} href={`/pedidos/${order.id}`}>
                    <Card className="cursor-pointer transition-shadow hover:shadow-md">
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <ShoppingBag className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {order.items.length} item(s) · {formatDate(order.createdAt)}
                            </p>
                            <p className="text-xs text-gray-400">
                              {order.items.slice(0, 2).map((i) => i.product.name).join(", ")}
                              {order.items.length > 2 && " ..."}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">
                            {formatCurrency(orderTotal)}
                          </span>
                          <Badge className={ORDER_STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"}>
                            {ORDER_STATUS_LABELS[order.status]}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">Nenhum pedido realizado.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
