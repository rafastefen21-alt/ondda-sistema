import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ROLES = ["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"];

// GET /api/crm/client-search?q= — busca clientes cadastrados para vincular a um lead
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ROLES.includes(session.user.role)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { tenantId } = session.user;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ clients: [] });

  const clients = await prisma.user.findMany({
    where: {
      tenantId,
      role: "CLIENTE",
      OR: [
        { name:         { contains: q, mode: "insensitive" } },
        { nomeFantasia: { contains: q, mode: "insensitive" } },
        { email:        { contains: q, mode: "insensitive" } },
        { cnpj:         { contains: q, mode: "insensitive" } },
        { phone:        { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, nomeFantasia: true, email: true, phone: true, cnpj: true },
    orderBy: { name: "asc" },
    take: 10,
  });

  return NextResponse.json({ clients });
}
