import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import crypto from "crypto";

/**
 * GET /api/auth/mercadopago
 *
 * Inicia o fluxo OAuth do Mercado Pago.
 * O usuário é redirecionado para a tela de autorização do MP.
 *
 * Pré-requisito: configure MP_APP_ID e MP_APP_SECRET no .env
 * e adicione a URL de callback no painel do app MP:
 *   {NEXTAUTH_URL}/api/auth/mercadopago/callback
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  if (!session?.user?.tenantId) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.redirect(`${baseUrl}/configuracoes`);
  }

  const APP_ID = process.env.MP_APP_ID;
  if (!APP_ID) {
    return NextResponse.redirect(
      `${baseUrl}/configuracoes?erro=MP_APP_ID não configurado no servidor.`,
    );
  }

  // Gera state aleatório para proteção contra CSRF
  const state = crypto.randomBytes(20).toString("hex");

  const redirectUri = `${baseUrl}/api/auth/mercadopago/callback`;

  const authUrl = new URL("https://auth.mercadopago.com.br/authorization");
  authUrl.searchParams.set("client_id", APP_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("platform_id", "mp");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  // Salva o state em cookie httpOnly para validar no callback
  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("mp_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutos
    path: "/",
  });

  return res;
}
