import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  unit: z.string().min(1),
  categoryId: z.string().optional(),
  minQuantity: z.number().positive().optional(),
  shelfLifeDays: z.number().int().positive().optional(),
  ncm:  z.string().max(10).optional().nullable(),
  cfop: z.string().max(5).optional().nullable(),
  imageUrl: z.string().url().optional(),
  active: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      tenantId: session.user.tenantId,
      ...parsed.data,
    },
  });

  return NextResponse.json(product, { status: 201 });
}
