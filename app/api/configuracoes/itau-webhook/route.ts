/**
 * Webhook de cobrança do Itaú — registro e consulta.
 *
 *  GET  → lista o que já está cadastrado no Itaú para este beneficiário.
 *  POST → gera as credenciais (se ainda não existirem) e cadastra a nossa
 *         URL de callback no Itaú.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CredenciaisItau,
  consultarWebhookItau,
  gerarCredenciaisWebhook,
  registrarWebhookItau,
} from "@/lib/itau";

const CAMPOS = {
  id: true, itauClientId: true, itauClientSecret: true, itauCertificado: true,
  itauChavePrivada: true, itauAgencia: true, itauConta: true, itauContaDac: true,
  itauAmbiente: true, itauWebhookClientId: true, itauWebhookClientSecret: true,
} as const;

type TenantItau = {
  id: string;
  itauClientId: string | null; itauClientSecret: string | null;
  itauCertificado: string | null; itauChavePrivada: string | null;
  itauAgencia: string | null; itauConta: string | null; itauContaDac: string | null;
  itauAmbiente: string | null;
  itauWebhookClientId: string | null; itauWebhookClientSecret: string | null;
};

/** Valida a sessão e devolve o tenant com as credenciais do Itaú completas. */
async function carregarTenant() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { erro: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }

  const tenant = (await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: CAMPOS,
  })) as TenantItau | null;

  if (!tenant?.itauClientId || !tenant.itauClientSecret ||
      !tenant.itauCertificado || !tenant.itauChavePrivada ||
      !tenant.itauAgencia || !tenant.itauConta || !tenant.itauContaDac) {
    return {
      erro: NextResponse.json(
        { error: "Configure as credenciais do Itaú (certificado, chave, secret e conta) antes de registrar o webhook." },
        { status: 400 },
      ),
    };
  }
  return { tenant };
}

function credenciais(t: TenantItau): CredenciaisItau {
  return {
    clientId:     t.itauClientId!,
    clientSecret: t.itauClientSecret!,
    certificado:  t.itauCertificado!,
    chavePrivada: t.itauChavePrivada!,
    agencia:      t.itauAgencia!,
    conta:        t.itauConta!,
    contaDac:     t.itauContaDac!,
    ambiente:     t.itauAmbiente ?? "Validacao",
  };
}

export async function GET() {
  const { erro, tenant } = await carregarTenant();
  if (erro) return erro;

  try {
    const { status, data } = await consultarWebhookItau({
      tenantId: tenant!.id,
      credenciais: credenciais(tenant!),
    });
    return NextResponse.json({ status, data }, { status: status >= 400 ? 502 : 200 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function POST() {
  const { erro, tenant } = await carregarTenant();
  if (erro) return erro;

  const baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl || baseUrl.startsWith("http://localhost")) {
    return NextResponse.json(
      { error: "O Itaú exige uma URL pública HTTPS. Configure NEXTAUTH_URL com o domínio de produção." },
      { status: 400 },
    );
  }

  // Reaproveita as credenciais já geradas; cria na primeira vez.
  let clientId     = tenant!.itauWebhookClientId;
  let clientSecret = tenant!.itauWebhookClientSecret;
  if (!clientId || !clientSecret) {
    const novas = gerarCredenciaisWebhook();
    clientId     = novas.clientId;
    clientSecret = novas.clientSecret;
    await prisma.tenant.update({
      where: { id: tenant!.id },
      data: { itauWebhookClientId: clientId, itauWebhookClientSecret: clientSecret },
    });
  }

  try {
    const { status, data } = await registrarWebhookItau({
      tenantId: tenant!.id,
      credenciais: credenciais(tenant!),
      webhookClientId: clientId,
      webhookClientSecret: clientSecret,
      baseUrl,
    });

    if (status >= 400) {
      return NextResponse.json({ error: "O Itaú recusou o registro.", status, data }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      webhookUrl:    `${baseUrl.replace(/\/$/, "")}/api/webhooks/itau`,
      webhookOauth:  `${baseUrl.replace(/\/$/, "")}/api/webhooks/itau/autorizacao`,
      data,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
