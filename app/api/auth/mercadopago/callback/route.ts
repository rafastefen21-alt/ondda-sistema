import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

/**
 * GET /api/auth/mercadopago/callback
 *
 * Recebe o redirecionamento do MP após o usuário autorizar.
 * Troca o `code` pelos tokens de acesso e salva no tenant.
 */
export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(req.url);

  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const mpErr = searchParams.get("error");

  // Usuário negou a autorização no MP
  if (mpErr || !code) {
    return NextResponse.redirect(
      `${baseUrl}/configuracoes?erro=Autorização negada no Mercado Pago.`,
    );
  }

  // Valida sessão
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  // Valida state (proteção CSRF)
  const cookieStore = await cookies();
  const savedState  = cookieStore.get("mp_oauth_state")?.value;

  const res = NextResponse.redirect(`${baseUrl}/configuracoes?mp=conectado`);
  res.cookies.delete("mp_oauth_state");

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(
      `${baseUrl}/configuracoes?erro=Estado inválido. Tente conectar novamente.`,
    );
  }

  const APP_ID      = process.env.MP_APP_ID;
  const APP_SECRET  = process.env.MP_APP_SECRET;
  const redirectUri = `${baseUrl}/api/auth/mercadopago/callback`;

  if (!APP_ID || !APP_SECRET) {
    return NextResponse.redirect(
      `${baseUrl}/configuracoes?erro=MP_APP_ID ou MP_APP_SECRET não configurados.`,
    );
  }

  // Troca o code pelos tokens
  try {
    const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        client_id:     APP_ID,
        client_secret: APP_SECRET,
        code,
        redirect_uri:  redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      const detail = tokenData.message ?? tokenData.error ?? "Erro desconhecido";
      return NextResponse.redirect(
        `${baseUrl}/configuracoes?erro=${encodeURIComponent(`Falha ao obter token: ${detail}`)}`,
      );
    }

    // Salva access_token e public_key no tenant
    await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: {
        mpAccessToken: tokenData.access_token,
        mpPublicKey:   tokenData.public_key ?? null,
      },
    });

    // Redireciona com sucesso (cookie de state já removido acima)
    return res;
  } catch (err) {
    console.error("[MP OAuth] callback error:", err);
    return NextResponse.redirect(
      `${baseUrl}/configuracoes?erro=${encodeURIComponent("Erro ao conectar com o Mercado Pago.")}`,
    );
  }
}
