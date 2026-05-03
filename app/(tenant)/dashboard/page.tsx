import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  ShoppingCart,
  CheckSquare,
  Factory,
  DollarSign,
  TrendingUp,
  Clock,
  Rocket,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/utils";
import Link from "next/link";

async function getDashboardData(tenantId: string, role: string, userId: string) {
  const isClient = role === "CLIENTE";
  const isAdmin = role === "TENANT_ADMIN";

  if (isClient) {
    const [myOrders, recentOrders] = await Promise.all([
      prisma.order.count({ where: { tenantId, clientId: userId } }),
      prisma.order.findMany({
        where: { tenantId, clientId: userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { items: { include: { product: true } } },
      }),
    ]);
    return { myOrders, recentOrders, type: "client" as const };
  }

  const [
    pendingApproval,
    inProduction,
    todayDeliveries,
    pendingPayments,
    recentOrders,
    tenant,
    productCount,
    clientCount,
  ] = await Promise.all([
    prisma.order.count({
      where: { tenantId, status: "PENDENTE_APROVACAO" },
    }),
    prisma.order.count({
      where: { tenantId, status: "EM_PRODUCAO" },
    }),
    prisma.order.count({
      where: {
        tenantId,
        status: "EM_ENTREGA",
        requestedDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    }),
    prisma.payment.aggregate({
      where: { tenantId, status: "PENDENTE" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.order.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        client: { select: { name: true } },
        items: { include: { product: true } },
      },
    }),
    isAdmin
      ? prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            cnpj: true, city: true, state: true,
            lojaLogoUrl: true, lojaBannerUrl: true,
            mpAccessToken: true, focusNfeToken: true,
          },
        })
      : Promise.resolve(null),
    isAdmin ? prisma.product.count({ where: { tenantId, active: true } }) : Promise.resolve(0),
    isAdmin ? prisma.user.count({ where: { tenantId, role: "CLIENTE" } }) : Promise.resolve(0),
  ]);

  // Build onboarding checklist (only for admins)
  const onboarding = isAdmin && tenant
    ? {
        fiscalDone:   !!(tenant.cnpj && tenant.city && tenant.state),
        productDone:  productCount > 0,
        clientDone:   clientCount > 0,
        storeDone:    !!(tenant.lojaLogoUrl || tenant.lojaBannerUrl),
        mpDone:       !!tenant.mpAccessToken,
        nfeDone:      !!tenant.focusNfeToken,
      }
    : null;

  return {
    pendingApproval,
    inProduction,
    todayDeliveries,
    pendingPayments,
    recentOrders,
    onboarding,
    type: "internal" as const,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.tenantId && session?.user?.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  const tenantId = session.user.tenantId!;
  const data = await getDashboardData(
    tenantId,
    session.user.role,
    session.user.id
  );

  if (data.type === "client") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Olá, {session.user.name?.split(" ")[0]}!
          </h1>
          <p className="text-gray-500">Acompanhe seus pedidos aqui.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Total de Pedidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-8 w-8 text-blue-700" />
                <span className="text-3xl font-bold">{data.myOrders}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Ação Rápida
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href="/catalogo"
                className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900"
              >
                <ShoppingCart className="h-4 w-4" />
                Fazer Novo Pedido
              </Link>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Pedidos Recentes
          </h2>
          <div className="space-y-3">
            {data.recentOrders.map((order) => (
              <Link key={order.id} href={`/pedidos/${order.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        Pedido #{order.id.slice(-6).toUpperCase()}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(order.createdAt)} •{" "}
                        {order.items.length} iten(s)
                      </p>
                      {order.scheduledDeliveryDate && (
                        <p className="mt-0.5 text-sm font-medium text-blue-900">
                          Entrega prevista: {formatDate(order.scheduledDeliveryDate)}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ORDER_STATUS_COLORS[order.status]}`}
                    >
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {data.recentOrders.length === 0 && (
              <p className="text-center text-gray-400 py-8">
                Nenhum pedido ainda.{" "}
                <Link href="/catalogo" className="text-blue-800 hover:underline">
                  Faça seu primeiro pedido!
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Internal dashboard
  const ob = data.onboarding;
  const onboardingDone = ob
    ? ob.fiscalDone && ob.productDone && ob.clientDone && ob.storeDone && ob.mpDone && ob.nfeDone
    : true;
  const onboardingSteps = ob
    ? [
        { label: "Dados fiscais preenchidos",    done: ob.fiscalDone,  href: "/configuracoes#dados-fiscais" },
        { label: "Primeiro produto cadastrado",  done: ob.productDone, href: "/produtos" },
        { label: "Primeiro cliente adicionado",  done: ob.clientDone,  href: "/clientes" },
        { label: "Loja personalizada (logo/banner)", done: ob.storeDone, href: "/configuracoes#loja-online" },
        { label: "Mercado Pago conectado",       done: ob.mpDone,  href: "/configuracoes#integracoes", key: "mp" },
        { label: "Token NF-e configurado",       done: ob.nfeDone, href: "/configuracoes#integracoes", key: "nfe" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">
          Visão geral do dia — {formatDate(new Date())}
        </p>
      </div>

      {/* Onboarding checklist — shown only to TENANT_ADMIN until everything is done */}
      {ob && !onboardingDone && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Rocket className="h-5 w-5" />
              Configure sua distribuidora
              <Badge className="ml-auto bg-blue-700 text-white text-xs">
                {onboardingSteps.filter((s) => s.done).length}/{onboardingSteps.length} concluídos
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {onboardingSteps.map((step) => (
                <li key={"key" in step ? step.key : step.href}>
                  <Link
                    href={step.href}
                    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                      step.done
                        ? "text-green-700 line-through opacity-60 cursor-default pointer-events-none"
                        : "text-blue-900 hover:bg-blue-100 font-medium"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                        step.done
                          ? "border-green-500 bg-green-500 text-white"
                          : "border-blue-500 bg-white"
                      }`}
                    >
                      {step.done && <Check className="h-3 w-3" />}
                    </span>
                    {step.label}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Clock className="h-4 w-4" />
              Aguardando Aprovação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {data.pendingApproval}
            </div>
            <Link
              href="/aprovacoes"
              className="text-xs text-blue-800 hover:underline"
            >
              Ver pedidos →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Factory className="h-4 w-4" />
              Em Produção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-800">
              {data.inProduction}
            </div>
            <Link
              href="/producao"
              className="text-xs text-blue-800 hover:underline"
            >
              Ver produção →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <ShoppingCart className="h-4 w-4" />
              Entregas Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-600">
              {data.todayDeliveries}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <DollarSign className="h-4 w-4" />
              A Receber
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-600">
              {formatCurrency(
                Number(data.pendingPayments._sum.amount ?? 0)
              )}
            </div>
            <p className="text-xs text-gray-400">
              {data.pendingPayments._count} pagamento(s) pendente(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Pedidos Recentes
          </h2>
          <Link
            href="/pedidos"
            className="text-sm text-blue-800 hover:underline"
          >
            Ver todos →
          </Link>
        </div>
        <Card>
          <div className="divide-y divide-gray-100">
            {data.recentOrders.map((order) => (
              <Link key={order.id} href={`/pedidos/${order.id}`}>
                <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        #{order.id.slice(-6).toUpperCase()} —{" "}
                        {"client" in order && order.client?.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(order.createdAt)} •{" "}
                        {order.items.length} iten(s)
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ORDER_STATUS_COLORS[order.status]}`}
                  >
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
              </Link>
            ))}
            {data.recentOrders.length === 0 && (
              <p className="py-8 text-center text-gray-400">
                Nenhum pedido cadastrado ainda.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
