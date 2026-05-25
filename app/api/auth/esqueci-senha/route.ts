import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://ondda-sistema.vercel.app";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, name: true, email: true },
  });

  // Sempre responde OK para não vazar se o email existe ou não
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  // Gera token seguro e expira em 1 hora
  const token   = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  // Remove tokens antigos do mesmo email e cria novo
  await prisma.verificationToken.deleteMany({ where: { identifier: user.email } });
  await prisma.verificationToken.create({
    data: { identifier: user.email, token, expires },
  });

  const resetUrl = `${APP_URL}/redefinir-senha?token=${token}&email=${encodeURIComponent(user.email)}`;
  await sendPasswordResetEmail(user.email, user.name ?? "Usuário", resetUrl);

  return NextResponse.json({ ok: true });
}
