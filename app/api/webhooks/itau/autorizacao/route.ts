/**
 * POST /api/webhooks/itau/autorizacao
 *
 * Endpoint OAuth2 (client_credentials) que o ITAÚ chama para obter um token
 * antes de nos notificar a baixa de um boleto.
 *
 * Conforme o manual do Itaú:
 *  - credenciais chegam no header Authorization: Basic base64(client_id:client_secret)
 *  - o body contém grant_type=client_credentials
 *
 * Cadastrar no Itaú como webhook_oauth_url.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assinarTokenWebhook, comparaSegura } from "@/lib/itau";

export async function POST(req: NextRequest) {
  // ── Credenciais no header Basic ──────────────────────────────────────────
  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("basic ")) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  }

  let clientId = "";
  let clientSecret = "";
  try {
    const decodificado = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const sep = decodificado.indexOf(":");
    if (sep < 0) throw new Error("formato inválido");
    clientId     = decodificado.slice(0, sep);
    clientSecret = decodificado.slice(sep + 1);
  } catch {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  }

  // ── grant_type deve ser client_credentials ───────────────────────────────
  const tipoConteudo = req.headers.get("content-type") ?? "";
  let grantType = "";
  try {
    if (tipoConteudo.includes("application/json")) {
      grantType = (await req.json())?.grant_type ?? "";
    } else {
      grantType = (await req.formData()).get("grant_type")?.toString() ?? "";
    }
  } catch {
    grantType = "";
  }
  if (grantType !== "client_credentials") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  }

  // ── Valida contra as credenciais do tenant ───────────────────────────────
  const tenant = await prisma.tenant.findFirst({
    where: { itauWebhookClientId: clientId },
    select: { id: true, itauWebhookClientSecret: true },
  });

  if (!tenant?.itauWebhookClientSecret ||
      !comparaSegura(clientSecret, tenant.itauWebhookClientSecret)) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  }

  const { token, expiresIn } = assinarTokenWebhook(tenant.id);

  return NextResponse.json(
    { access_token: token, token_type: "Bearer", expires_in: expiresIn },
    { headers: { "Cache-Control": "no-store" } },
  );
}
