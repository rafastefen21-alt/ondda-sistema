import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { zapiSendText, renderMessage } from "@/lib/zapi";
import { z } from "zod";

const recipientSchema = z.object({
  clientId:     z.string(),
  phone:        z.string(),
  nome:         z.string().optional(),
  nomeFantasia: z.string().optional().nullable(),
});

const bodySchema = z.object({
  message:    z.string().min(1, "Mensagem não pode ser vazia"),
  recipients: z.array(recipientSchema).min(1, "Selecione ao menos um destinatário"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "SUPER_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { tenantId } = session.user;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { zapiInstanceId: true, zapiToken: true },
  });

  if (!tenant?.zapiInstanceId || !tenant?.zapiToken) {
    return NextResponse.json(
      { error: "Z-API não configurada. Vá em Configurações → Integrações." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos" },
      { status: 400 },
    );
  }

  const { message, recipients } = parsed.data;
  const cfg = { instanceId: tenant.zapiInstanceId, token: tenant.zapiToken };

  const results = await Promise.all(
    recipients.map(async (r) => {
      const text = renderMessage(message, {
        nome:         r.nome,
        nomeFantasia: r.nomeFantasia ?? undefined,
      });
      const result = await zapiSendText(cfg, r.phone, text);
      return { clientId: r.clientId, nome: r.nome, phone: r.phone, ...result };
    }),
  );

  const success = results.filter((r) => r.success).length;
  const failed  = results.filter((r) => !r.success).length;

  return NextResponse.json({ success, failed, results });
}
