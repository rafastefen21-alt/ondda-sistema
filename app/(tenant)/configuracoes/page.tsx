import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Building2, Users, Package, FileText } from "lucide-react";
import Link from "next/link";
import { LojaConfigForm } from "./loja-config-form";
import { UsuariosManager } from "./usuarios-manager";
import { IntegracoesForm } from "./integracoes-form";
import { FiscalForm } from "./fiscal-form";

export default async function ConfiguracoesPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role, id: currentUserId } = session.user;
  if (!["TENANT_ADMIN", "SUPER_ADMIN"].includes(role)) {
    redirect("/dashboard");
  }

  const [tenant, stats, internalUsers] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
    }),
    prisma.$transaction([
      prisma.user.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId, active: true } }),
      prisma.order.count({ where: { tenantId } }),
    ]),
    prisma.user.findMany({
      where: { tenantId, role: { in: ["TENANT_ADMIN", "GERENTE", "OPERADOR"] } },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const [userCount, productCount, orderCount] = stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500">Gerencie sua distribuidora</p>
      </div>

      {/* Tenant info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-700" />
            Informações da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Nome
              </p>
              <p className="text-sm font-medium text-gray-900">{tenant?.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                CNPJ
              </p>
              <p className="text-sm text-gray-900">{tenant?.cnpj ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Email
              </p>
              <p className="text-sm text-gray-900">{tenant?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Plano
              </p>
              <Badge variant={tenant?.plan === "PRO" ? "default" : "secondary"}>
                {tenant?.plan}
              </Badge>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Cidade / Estado
              </p>
              <p className="text-sm text-gray-900">
                {tenant?.city && tenant?.state
                  ? `${tenant.city} / ${tenant.state}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Subdomínio (slug)
              </p>
              <p className="text-sm font-mono text-gray-900">{tenant?.slug}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{userCount}</p>
              <p className="text-sm text-gray-500">Usuários</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Package className="h-8 w-8 text-blue-700" />
            <div>
              <p className="text-2xl font-bold">{productCount}</p>
              <p className="text-sm text-gray-500">Produtos ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <FileText className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{orderCount}</p>
              <p className="text-sm text-gray-500">Pedidos no total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fiscal data */}
      {tenant && (
        <div id="dados-fiscais" className="scroll-mt-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Settings className="h-5 w-5 text-blue-700" />
            Dados Fiscais
          </h2>
          <FiscalForm
            initial={{
              cnpj:             tenant.cnpj             ?? null,
              ie:               tenant.ie               ?? null,
              cnae:             tenant.cnae             ?? null,
              regimeTributario: tenant.regimeTributario ?? null,
              cep:              tenant.cep              ?? null,
              logradouro:       tenant.logradouro       ?? null,
              numero:           tenant.numero           ?? null,
              complemento:      tenant.complemento      ?? null,
              bairro:           tenant.bairro           ?? null,
              city:             tenant.city             ?? null,
              state:            tenant.state            ?? null,
              codigoCidade:     tenant.codigoCidade     ?? null,
              phone:            tenant.phone            ?? null,
            }}
          />
        </div>
      )}

      {/* Integrations */}
      <div id="integracoes" className="scroll-mt-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Settings className="h-5 w-5 text-blue-700" />
          Integrações
        </h2>
        <div className="space-y-4">
          {tenant && (
            <IntegracoesForm
              initial={{
                mpPublicKey:   tenant.mpPublicKey   ?? null,
                mpAccessToken: tenant.mpAccessToken ?? null,
                focusNfeToken: tenant.focusNfeToken ?? null,
                nfeAmbiente:   tenant.nfeAmbiente   ?? null,
              }}
            />
          )}
        </div>
      </div>

      {/* Users management */}
      <div id="usuarios" className="scroll-mt-6">
      <UsuariosManager
        initial={internalUsers.map((u) => ({
          ...u,
          role: u.role as "TENANT_ADMIN" | "GERENTE" | "OPERADOR",
          createdAt: u.createdAt.toISOString(),
        }))}
        currentUserId={currentUserId}
      />
      </div>

      {/* Loja customization */}
      <div id="loja-online" className="scroll-mt-6">
      {tenant && (
        <LojaConfigForm
          slug={tenant.slug}
          initial={{
            lojaCorPrimaria: tenant.lojaCorPrimaria,
            lojaBannerUrl: tenant.lojaBannerUrl,
            lojaLogoUrl: tenant.lojaLogoUrl,
            lojaDescricao: tenant.lojaDescricao,
          }}
        />
      )}
      </div>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/clientes">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-6 w-6 text-blue-500" />
              <div>
                <p className="font-medium text-gray-900">Gerenciar Clientes</p>
                <p className="text-sm text-gray-400">
                  Adicione e gerencie clientes
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/produtos">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              <Package className="h-6 w-6 text-blue-700" />
              <div>
                <p className="font-medium text-gray-900">Catálogo de Produtos</p>
                <p className="text-sm text-gray-400">
                  Gerencie preços e produtos
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
