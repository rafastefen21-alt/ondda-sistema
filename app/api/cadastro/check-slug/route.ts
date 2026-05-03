import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug")?.trim().toLowerCase();

  if (!slug || slug.length < 2) {
    return NextResponse.json({ available: false, error: "Slug muito curto." });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ available: false, error: "Use apenas letras, números e hífens." });
  }

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  return NextResponse.json({ available: !existing });
}
