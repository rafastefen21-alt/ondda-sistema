import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;

  // Check if category has products
  const count = await prisma.product.count({
    where: { categoryId: id, tenantId: session.user.tenantId },
  });

  if (count > 0) {
    return NextResponse.json(
      { error: `Essa categoria tem ${count} produto(s) vinculado(s). Remova ou mova os produtos antes de excluir.` },
      { status: 409 }
    );
  }

  await prisma.productCategory.delete({
    where: { id, tenantId: session.user.tenantId },
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;
  const { name } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Nome obrigatório." }, { status: 400 });
  }

  const category = await prisma.productCategory.update({
    where: { id, tenantId: session.user.tenantId },
    data: { name: name.trim() },
    include: { _count: { select: { products: true } } },
  });

  return NextResponse.json(category);
}
