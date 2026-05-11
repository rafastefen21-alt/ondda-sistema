import { prisma } from "@/lib/prisma";
import type { StockMovementType } from "@/app/generated/prisma/client";

export type StockStatus = "OK" | "ALERTA" | "CRITICO";

export function getStockStatus(
  quantity: number,
  alertThreshold: number | null,
): StockStatus {
  if (quantity <= 0) return "CRITICO";
  if (alertThreshold !== null && quantity <= alertThreshold) return "ALERTA";
  return "OK";
}

/**
 * Ajusta o estoque de um produto (cria StockItem se não existir).
 * delta positivo = entrada, negativo = saída.
 */
export async function adjustStock({
  tenantId,
  productId,
  delta,
  type,
  reason,
  orderId,
}: {
  tenantId:  string;
  productId: string;
  delta:     number;
  type:      StockMovementType;
  reason?:   string;
  orderId?:  string;
}) {
  // Upsert do StockItem
  const item = await prisma.stockItem.upsert({
    where:  { productId },
    create: { tenantId, productId, quantity: 0 },
    update: {},
  });

  // Atualiza a quantidade (não deixa ir abaixo de 0 em saída)
  const newQty = Math.max(0, Number(item.quantity) + delta);

  const [updated] = await prisma.$transaction([
    prisma.stockItem.update({
      where: { id: item.id },
      data:  { quantity: newQty },
    }),
    prisma.stockMovement.create({
      data: {
        tenantId,
        stockItemId: item.id,
        type,
        quantity: delta,
        reason:   reason ?? null,
        orderId:  orderId ?? null,
      },
    }),
  ]);

  return updated;
}

/**
 * Desconta estoque de todos os itens de um pedido ao aprovar.
 * Chamado após mudança de status para APROVADO.
 */
export async function deductStockForOrder(
  tenantId: string,
  orderId:  string,
) {
  const order = await prisma.order.findFirst({
    where:   { id: orderId, tenantId },
    include: { items: true },
  });
  if (!order) return;

  await Promise.all(
    order.items.map((item) =>
      adjustStock({
        tenantId,
        productId: item.productId,
        delta:     -Number(item.quantity),
        type:      "SAIDA",
        reason:    `Pedido aprovado #${orderId.slice(-8).toUpperCase()}`,
        orderId,
      }),
    ),
  );
}

/**
 * Statuses que já tiveram o estoque descontado.
 * Ao cancelar um pedido nestes estados, o estoque deve ser restaurado.
 */
export const STATUSES_WITH_STOCK_DEDUCTED = [
  "APROVADO",
  "EM_PRODUCAO",
  "PRONTO",
  "EM_ENTREGA",
] as const;

/**
 * Restaura estoque de todos os itens de um pedido cancelado.
 * Só deve ser chamado se o pedido estava em um status que já havia descontado.
 */
export async function restoreStockForOrder(
  tenantId: string,
  orderId:  string,
) {
  const order = await prisma.order.findFirst({
    where:   { id: orderId, tenantId },
    include: { items: true },
  });
  if (!order) return;

  await Promise.all(
    order.items.map((item) =>
      adjustStock({
        tenantId,
        productId: item.productId,
        delta:     +Number(item.quantity),
        type:      "ENTRADA",
        reason:    `Pedido cancelado #${orderId.slice(-8).toUpperCase()} — estoque restaurado`,
        orderId,
      }),
    ),
  );
}
