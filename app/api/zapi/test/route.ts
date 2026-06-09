import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { zapiTestConnection } from "@/lib/zapi";

export async function POST() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { zapiInstanceId: true, zapiToken: true },
  });

  if (!tenant?.zapiInstanceId || !tenant?.zapiToken) {
    return NextResponse.json(
      { error: "Z-API não configurada. Salve o Instance ID e Token primeiro." },
      { status: 400 },
    );
  }

  try {
    const result = await zapiTestConnection({
      instanceId: tenant.zapiInstanceId,
      token: tenant.zapiToken,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao conectar";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
