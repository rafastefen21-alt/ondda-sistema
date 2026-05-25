import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { email, token, password } = await req.json();

  if (!email || !token || !password || password.length < 6) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  // Verifica o token
  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record || record.identifier !== email || record.expires < new Date()) {
    return NextResponse.json(
      { error: "Link inválido ou expirado. Solicite um novo." },
      { status: 400 },
    );
  }

  // Atualiza a senha
  const hash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { email },
    data: { password: hash },
  });

  // Invalida o token
  await prisma.verificationToken.delete({ where: { token } });

  return NextResponse.json({ ok: true });
}
