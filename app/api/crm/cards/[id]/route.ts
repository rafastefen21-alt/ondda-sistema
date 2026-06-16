import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const NOVOS_STAGES    = ["PRIMEIRO_CONTATO", "ENVIO_AMOSTRA", "NEGOCIACAO", "FECHADO"] as const;
const POS_VENDA_STAGES = ["PESQUISA_SATISFACAO", "VERIFICACAO_ESTOQUE", "RECOMPROU"] as const;

const patchSchema = z.object({
  stage:      z.string().optional(),
  notes:      z.string().optional(),
  leadName:   z.string().optional(),
  leadPhone:  z.string().optional(),
  leadEmail:  z.string().optional(),
  leadSource: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;
  const { tenantId } = session.user;

  const existing = await prisma.crmCard.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Card não encontrado" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const updateData: Record<string, unknown> = {};

  if (parsed.data.notes    !== undefined) updateData.notes    = parsed.data.notes;
  if (parsed.data.leadName  !== undefined) updateData.leadName  = parsed.data.leadName;
  if (parsed.data.leadPhone !== undefined) updateData.leadPhone = parsed.data.leadPhone || null;
  if (parsed.data.leadEmail !== undefined) updateData.leadEmail = parsed.data.leadEmail || null;
  if (parsed.data.leadSource !== undefined) updateData.leadSource = parsed.data.leadSource || null;

  if (parsed.data.stage) {
    const newStage = parsed.data.stage;

    // Se mover para FECHADO na aba NOVOS → promover para Pós-Venda
    if (newStage === "FECHADO" && existing.tab === "NOVOS") {
      updateData.tab   = "POS_VENDA";
      updateData.stage = "PESQUISA_SATISFACAO";
    } else if ((NOVOS_STAGES as readonly string[]).includes(newStage) ||
               (POS_VENDA_STAGES as readonly string[]).includes(newStage)) {
      updateData.stage = newStage;
      // Ajusta tab conforme o stage
      if ((NOVOS_STAGES as readonly string[]).includes(newStage) && newStage !== "FECHADO") {
        updateData.tab = "NOVOS";
      } else if ((POS_VENDA_STAGES as readonly string[]).includes(newStage)) {
        updateData.tab = "POS_VENDA";
      }
    }
  }

  const updated = await prisma.crmCard.update({
    where: { id },
    data: updateData,
    include: { client: { select: { id: true, name: true, nomeFantasia: true, email: true, phone: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;
  const { tenantId } = session.user;

  const existing = await prisma.crmCard.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Card não encontrado" }, { status: 404 });

  await prisma.crmCard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
