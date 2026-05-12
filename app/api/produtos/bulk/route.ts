import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

/**
 * DELETE /api/produtos/bulk
 * Body: { ids: string[] }
 * Apaga permanentemente os produtos listados que pertençam ao tenant.
 * Restrito a TENANT_ADMIN.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TENANT_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bulkDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { ids } = parsed.data;
  const tenantId = session.user.tenantId;

  const { count } = await prisma.product.deleteMany({
    where: { id: { in: ids }, tenantId },
  });

  return NextResponse.json({ deleted: count });
}
