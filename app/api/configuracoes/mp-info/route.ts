import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { mpAccessToken: true },
  });

  if (!tenant?.mpAccessToken) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }

  try {
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${tenant.mpAccessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "MP error", status: res.status }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json({
      id:       data.id,
      nickname: data.nickname ?? null,
      email:    data.email    ?? null,
      fullName: [data.first_name, data.last_name].filter(Boolean).join(" ") || null,
      siteId:   data.site_id  ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Fetch error" }, { status: 500 });
  }
}
