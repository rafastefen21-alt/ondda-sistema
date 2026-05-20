import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  title:      z.string().min(1).max(120).optional(),
  quantity:   z.string().max(40).optional().nullable(),
  notes:      z.string().max(500).optional().nullable(),
  expectedAt: z.string().optional().nullable(),
  status:     z.enum(["SOLICITADO", "EM_PRODUCAO", "A_CAMINHO", "RECEBIDO"]).optional(),
});

/** PATCH /api/fabrica/pedidos/[id] — atualiza status, campos etc. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, quantity, notes, expectedAt, status } = parsed.data;

  const data: Record<string, unknown> = {};
  if (title      !== undefined) data.title      = title;
  if (quantity   !== undefined) data.quantity   = quantity;
  if (notes      !== undefined) data.notes      = notes;
  if (status     !== undefined) {
    data.status = status;
    if (status === "RECEBIDO") data.receivedAt = new Date();
  }
  if (expectedAt !== undefined) {
    data.expectedAt = expectedAt ? new Date(expectedAt) : null;
  }

  const order = await prisma.factoryOrder.update({
    where: { id, tenantId: session.user.tenantId },
    data,
  });

  return NextResponse.json(order);
}

/** DELETE /api/fabrica/pedidos/[id] */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.factoryOrder.delete({
    where: { id, tenantId: session.user.tenantId },
  });

  return NextResponse.json({ success: true });
}
