import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatCurrency,
  formatDate,
  PAYMENT_METHOD_LABELS,
} from "@/lib/utils";
import Link from "next/link";
import { CustosDonutChart } from "./custos-donut-chart";

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(role)) {
    redirect("/dashboard");
  }

  const { month } = await searchParams;
  const baseDate = month ? new Date(month + "-01") : new Date();
  const monthStart = startOfMonth(baseDate);
  const monthEnd = endOfMonth(baseDate);

  const monthLabel = format(baseDate, "MMMM yyyy", { locale: ptBR });

  const [payments, costs, overduePayments] = await Promise.all([
    prisma.payment.findMany({
      where: {
        tenantId,
        dueDate: { gte: monthStart, lte: monthEnd },
      },
      include: {
        order: {
          include: { client: { select: { name: true } } },
        },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.operationalCost.findMany({
      where: {
        tenantId,
        date: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { date: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        tenantId,
        status: "VENCIDO",
      },
      include: {
        order: { include: { client: { select: { name: true } } } },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);

  const totalReceived = payments
    .filter((p) => p.status === "PAGO")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalPending = payments
    .filter((p) => p.status === "PENDENTE")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalCosts = costs.reduce((sum, c) => sum + Number(c.amount), 0);
  const netBalance = totalReceived - totalCosts;

  // Ticket médio — mediana dos valores de pagamento do mês
  const allAmounts = payments.map((p) => Number(p.amount)).sort((a, b) => a - b);
  const ticketMedio = (() => {
    if (allAmounts.length === 0) return 0;
    const mid = Math.floor(allAmounts.length / 2);
    return allAmounts.length % 2 !== 0
      ? allAmounts[mid]
      : (allAmounts[mid - 1] + allAmounts[mid]) / 2;
  })();

  // Group costs by category
  const costsByCategory = costs.reduce<Record<string, number>>((acc, c) => {
    acc[c.category] = (acc[c.category] ?? 0) + Number(c.amount);
    return acc;
  }, {});

  const prevMonth = format(
    new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1),
    "yyyy-MM"
  );
  const nextMonth = format(
    new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1),
    "yyyy-MM"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-500 capitalize">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/financeiro?month=${prevMonth}`}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ← Mês anterior
          </a>
          <a
            href="/financeiro"
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Este mês
          </a>
          <a
            href={`/financeiro?month=${nextMonth}`}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Próximo →
          </a>
          <Link
            href="/financeiro/novo-custo"
            className="rounded-md bg-blue-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-900"
          >
            + Custo
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-gray-500">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Recebido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalReceived)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-gray-500">
              <DollarSign className="h-4 w-4 text-yellow-500" />
              A Receber
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              {formatCurrency(totalPending)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-gray-500">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Custos Operacionais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(totalCosts)}
            </p>
          </CardContent>
        </Card>

        <Card className={netBalance >= 0 ? "border-green-200" : "border-red-200"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-500">
              Saldo Líquido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-bold ${
                netBalance >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(netBalance)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-gray-500">
              <BarChart2 className="h-4 w-4 text-blue-500" />
              Ticket Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-700">
              {formatCurrency(ticketMedio)}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              mediana de {allAmounts.length} pagamento{allAmounts.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue payments alert */}
      {overduePayments.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-red-700">
              <AlertCircle className="h-4 w-4" />
              Pagamentos Vencidos ({overduePayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overduePayments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-red-700">
                    {p.order.client?.name} — venceu {formatDate(p.dueDate)}
                  </span>
                  <span className="font-semibold text-red-700">
                    {formatCurrency(Number(p.amount))}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payments */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Pagamentos do Mês
          </h2>
          <Card>
            <div className="divide-y divide-gray-100">
              {payments.length > 0 ? (
                payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {p.order.client?.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {PAYMENT_METHOD_LABELS[p.method]} •{" "}
                        {p.installments > 1
                          ? `${p.installmentN}/${p.installments} `
                          : ""}
                        Vence: {formatDate(p.dueDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(Number(p.amount))}
                      </span>
                      <Badge
                        variant={
                          p.status === "PAGO"
                            ? "success"
                            : p.status === "VENCIDO"
                            ? "destructive"
                            : "warning"
                        }
                      >
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-gray-400">
                  Nenhum pagamento neste mês.
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Costs */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Custos Operacionais
          </h2>

          {/* Donut chart by category */}
          {Object.keys(costsByCategory).length > 0 && (
            <div className="mb-4">
              <CustosDonutChart
                data={Object.entries(costsByCategory).map(([category, total]) => ({
                  category,
                  total,
                }))}
                totalCosts={totalCosts}
              />
            </div>
          )}

          <Card>
            <div className="divide-y divide-gray-100">
              {costs.length > 0 ? (
                costs.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {c.description}
                      </p>
                      <p className="text-xs text-gray-400">
                        {c.category} • {formatDate(c.date)}
                      </p>
                    </div>
                    <span className="font-semibold text-red-600">
                      -{formatCurrency(Number(c.amount))}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-gray-400">
                  Nenhum custo registrado este mês.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
