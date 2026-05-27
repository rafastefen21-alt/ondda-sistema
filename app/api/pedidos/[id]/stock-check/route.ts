import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LOW_STOCK_THRESHOLD = 50;

/**
 * GET /api/pedidos/[id]/stock-check
 *
 * Verifica o estoque dos produtos do pedido antes da aprovação.
 * Retorna alertas para produtos em falta ou abaixo de 50 unidades.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { tenantId } = session.user;

  const order = await prisma.order.findFirst({
    where: { id, tenantId },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, unit: true } },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  // Busca o estoque de todos os produtos do pedido
  const productIds = order.items.map((i) => i.product.id);
  const stockItems = await prisma.stockItem.findMany({
    where: { tenantId, productId: { in: productIds } },
    select: { productId: true, quantity: true },
  });

  const stockMap = new Map(stockItems.map((s) => [s.productId, Number(s.quantity)]));

  type Severity = "FALTA" | "INSUFICIENTE" | "BAIXO";
  const alerts: {
    productId:   string;
    productName: string;
    unit:        string;
    orderQty:    number;
    stockQty:    number;
    severity:    Severity;
  }[] = [];

  for (const item of order.items) {
    const pid      = item.product.id;
    const stockQty = stockMap.get(pid) ?? 0;   // sem StockItem = 0
    const orderQty = Number(item.quantity);

    let severity: Severity | null = null;

    if (stockQty <= 0) {
      severity = "FALTA";                        // totalmente em falta
    } else if (stockQty < orderQty) {
      severity = "INSUFICIENTE";                 // tem, mas não suficiente para o pedido
    } else if (stockQty < LOW_STOCK_THRESHOLD) {
      severity = "BAIXO";                        // suficiente para o pedido, mas abaixo de 50
    }

    if (severity) {
      alerts.push({
        productId:   pid,
        productName: item.product.name,
        unit:        item.product.unit,
        orderQty,
        stockQty,
        severity,
      });
    }
  }

  return NextResponse.json({ alerts });
}
