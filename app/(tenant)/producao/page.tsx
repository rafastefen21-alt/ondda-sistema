import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { addDays, startOfWeek, endOfWeek, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Factory, Package, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/utils";

type ProductionItem = {
  productId: string;
  productName: string;
  unit: string;
  totalQuantity: number;
  orders: {
    orderId: string;
    clientName: string | null;
    quantity: number;
    status: string;
    requestedDate: Date | null;
  }[];
};

export default async function ProducaoPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (role === "CLIENTE") redirect("/dashboard");

  const { week } = await searchParams;
  const baseDate = week ? new Date(week) : new Date();
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 }); // Sunday

  // Get orders in production or approved for this week
  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      status: { in: ["APROVADO", "EM_PRODUCAO", "PRONTO"] },
      OR: [
        {
          requestedDate: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
        {
          requestedDate: null,
          createdAt: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
      ],
    },
    include: {
      client: { select: { name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, unit: true } },
        },
      },
    },
    orderBy: { requestedDate: "asc" },
  });

  // Aggregate by product
  const productionMap: Record<string, ProductionItem> = {};
  for (const order of orders) {
    for (const item of order.items) {
      const pid = item.product.id;
      if (!productionMap[pid]) {
        productionMap[pid] = {
          productId: pid,
          productName: item.product.name,
          unit: item.product.unit,
          totalQuantity: 0,
          orders: [],
        };
      }
      productionMap[pid].totalQuantity += Number(item.quantity);
      productionMap[pid].orders.push({
        orderId: order.id,
        clientName: order.client.name,
        quantity: Number(item.quantity),
        status: order.status,
        requestedDate: order.requestedDate,
      });
    }
  }

  const productionItems = Object.values(productionMap).sort(
    (a, b) => b.totalQuantity - a.totalQuantity
  );

  const weekLabel = `${format(weekStart, "dd/MM", { locale: ptBR })} – ${format(weekEnd, "dd/MM/yyyy", { locale: ptBR })}`;

  const prevWeek = format(addDays(weekStart, -7), "yyyy-MM-dd");
  const nextWeek = format(addDays(weekStart, 7), "yyyy-MM-dd");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Produção da Semana
          </h1>
          <p className="text-gray-500">
            {weekLabel} — {orders.length} pedido(s) em aberto
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/producao?week=${prevWeek}`}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ← Semana anterior
          </a>
          <a
            href="/producao"
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Esta semana
          </a>
          <a
            href={`/producao?week=${nextWeek}`}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            Próxima →
          </a>
        </div>
      </div>

      {/* Production summary cards */}
      {productionItems.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {productionItems.map((item) => (
              <Card key={item.productId}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4 text-blue-700" />
                    {item.productName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-3">
                    <span className="text-3xl font-bold text-blue-900">
                      {item.totalQuantity}
                    </span>
                    <span className="ml-1 text-gray-500">{item.unit}</span>
                  </div>
                  <div className="space-y-1.5">
                    {item.orders.map((o, i) => (
                      <div
                        key={`${o.orderId}-${i}`}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_COLORS[o.status]}`}
                          >
                            {ORDER_STATUS_LABELS[o.status]}
                          </span>
                          <span className="text-gray-600">{o.clientName}</span>
                        </div>
                        <span className="font-semibold text-gray-700">
                          {o.quantity} {item.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Orders table */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Pedidos da Semana
            </h2>
            <Card>
              <div className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <div key={order.id} className="flex items-start gap-4 p-4">
                    <div className="flex-shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                        <Factory className="h-4 w-4 text-blue-800" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          #{order.id.slice(-6).toUpperCase()} — {order.client.name}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ORDER_STATUS_COLORS[order.status]}`}
                        >
                          {ORDER_STATUS_LABELS[order.status]}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {order.items.map((item) => (
                          <span
                            key={item.id}
                            className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            {item.product.name}: {Number(item.quantity)}{" "}
                            {item.product.unit}
                          </span>
                        ))}
                      </div>
                      {order.requestedDate && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="h-3 w-3" />
                          Entrega prevista:{" "}
                          {format(order.requestedDate, "dd/MM/yyyy", {
                            locale: ptBR,
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20">
          <Factory className="mb-4 h-12 w-12 text-gray-200" />
          <p className="text-gray-500">
            Nenhum pedido em produção para esta semana.
          </p>
        </div>
      )}
    </div>
  );
}
