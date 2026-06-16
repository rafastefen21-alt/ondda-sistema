import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  leadName:   z.string().min(1),
  leadPhone:  z.string().optional(),
  leadEmail:  z.string().email().optional().or(z.literal("")),
  leadSource: z.string().optional(),
  clientId:   z.string().optional(),
  notes:      z.string().optional(),
  stage:      z.string().default("PRIMEIRO_CONTATO"),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { tenantId } = session.user;
  const tab = new URL(req.url).searchParams.get("tab") ?? "NOVOS";

  const cards = await prisma.crmCard.findMany({
    where: { tenantId, tab },
    include: {
      client: {
        select: { id: true, name: true, nomeFantasia: true, email: true, phone: true },
      },
    },
    orderBy: [{ stage: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(cards);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { tenantId } = session.user;
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const card = await prisma.crmCard.create({
    data: {
      tenantId,
      tab:        "NOVOS",
      stage:      parsed.data.stage,
      leadName:   parsed.data.leadName,
      leadPhone:  parsed.data.leadPhone || null,
      leadEmail:  parsed.data.leadEmail || null,
      leadSource: parsed.data.leadSource || null,
      clientId:   parsed.data.clientId || null,
      notes:      parsed.data.notes || null,
    },
    include: { client: { select: { id: true, name: true, nomeFantasia: true, email: true, phone: true } } },
  });

  return NextResponse.json(card, { status: 201 });
}
