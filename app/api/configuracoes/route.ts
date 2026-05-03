import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  // Loja customization
  lojaCorPrimaria: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  lojaBannerUrl:   z.string().url().optional().or(z.literal("")),
  lojaLogoUrl:     z.string().url().optional().or(z.literal("")),
  lojaDescricao:   z.string().max(200).optional(),
  // Integrações
  mpPublicKey:     z.string().optional().nullable(),
  mpAccessToken:   z.string().optional().nullable(),
  focusNfeToken:   z.string().optional().nullable(),
  nfeAmbiente:     z.enum(["homologacao", "producao"]).optional(),
  // Dados fiscais
  cnpj:             z.string().optional().nullable(),
  ie:               z.string().optional().nullable(),
  cnae:             z.string().optional().nullable(),
  regimeTributario: z.string().optional().nullable(),
  cep:              z.string().optional().nullable(),
  logradouro:       z.string().optional().nullable(),
  numero:           z.string().optional().nullable(),
  complemento:      z.string().optional().nullable(),
  bairro:           z.string().optional().nullable(),
  city:             z.string().optional().nullable(),
  state:            z.string().optional().nullable(),
  codigoCidade:     z.string().optional().nullable(),
  phone:            z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const d = parsed.data;

  const tenant = await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: {
      // loja
      ...(d.lojaCorPrimaria !== undefined ? { lojaCorPrimaria: d.lojaCorPrimaria } : {}),
      ...(d.lojaBannerUrl   !== undefined ? { lojaBannerUrl:   d.lojaBannerUrl || null } : {}),
      ...(d.lojaLogoUrl     !== undefined ? { lojaLogoUrl:     d.lojaLogoUrl   || null } : {}),
      ...(d.lojaDescricao   !== undefined ? { lojaDescricao:   d.lojaDescricao } : {}),
      // integrações
      ...(d.mpPublicKey     !== undefined ? { mpPublicKey:     d.mpPublicKey   || null } : {}),
      ...(d.mpAccessToken   !== undefined ? { mpAccessToken:   d.mpAccessToken || null } : {}),
      ...(d.focusNfeToken   !== undefined ? { focusNfeToken:   d.focusNfeToken || null } : {}),
      ...(d.nfeAmbiente     !== undefined ? { nfeAmbiente:     d.nfeAmbiente } : {}),
      // dados fiscais
      ...(d.cnpj             !== undefined ? { cnpj:             d.cnpj             || null } : {}),
      ...(d.ie               !== undefined ? { ie:               d.ie               || null } : {}),
      ...(d.cnae             !== undefined ? { cnae:             d.cnae             || null } : {}),
      ...(d.regimeTributario !== undefined ? { regimeTributario: d.regimeTributario || null } : {}),
      ...(d.cep              !== undefined ? { cep:              d.cep              || null } : {}),
      ...(d.logradouro       !== undefined ? { logradouro:       d.logradouro       || null } : {}),
      ...(d.numero           !== undefined ? { numero:           d.numero           || null } : {}),
      ...(d.complemento      !== undefined ? { complemento:      d.complemento      || null } : {}),
      ...(d.bairro           !== undefined ? { bairro:           d.bairro           || null } : {}),
      ...(d.city             !== undefined ? { city:             d.city             || null } : {}),
      ...(d.state            !== undefined ? { state:            d.state            || null } : {}),
      ...(d.codigoCidade     !== undefined ? { codigoCidade:     d.codigoCidade     || null } : {}),
      ...(d.phone            !== undefined ? { phone:            d.phone            || null } : {}),
    },
  });

  return NextResponse.json(tenant);
}
