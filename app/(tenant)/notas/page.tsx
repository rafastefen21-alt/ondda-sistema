import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Download, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary"; icon: React.ElementType }
> = {
  EMITIDA: { label: "Emitida", variant: "success", icon: CheckCircle2 },
  PROCESSANDO: { label: "Processando", variant: "warning", icon: Clock },
  ERRO: { label: "Erro", variant: "destructive", icon: AlertCircle },
  CANCELADA: { label: "Cancelada", variant: "secondary", icon: XCircle },
};

export default async function NotasPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(role)) {
    redirect("/dashboard");
  }

  const invoices = await prisma.invoice.findMany({
    where: { tenantId },
    include: {
      order: {
        include: {
          client: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notas Fiscais</h1>
          <p className="text-gray-500">{invoices.length} nota(s) emitida(s)</p>
        </div>
      </div>

      {invoices.length > 0 ? (
        <Card>
          <div className="divide-y divide-gray-100">
            {invoices.map((invoice) => {
              const config = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.PROCESSANDO;
              const Icon = config.icon;
              return (
                <div key={invoice.id} className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-gray-100">
                    <FileText className="h-5 w-5 text-gray-500" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">
                        {invoice.number
                          ? `NF-e nº ${invoice.number}`
                          : `NF-e — ${invoice.order.client?.name}`}
                      </p>
                      <Badge variant={config.variant} className="flex items-center gap-1">
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-400">
                      Cliente: {invoice.order.client?.name} •{" "}
                      {invoice.issuedAt
                        ? `Emitida em ${formatDate(invoice.issuedAt)}`
                        : `Criada em ${formatDate(invoice.createdAt)}`}
                    </p>
                    {invoice.errorMsg && (
                      <p className="mt-1 text-xs text-red-500">{invoice.errorMsg}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {invoice.pdfUrl && (
                      <a
                        href={invoice.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        DANFe
                      </a>
                    )}
                    {invoice.xmlUrl && (
                      <a
                        href={invoice.xmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        XML
                      </a>
                    )}
                    <Link
                      href={`/pedidos/${invoice.orderId}`}
                      className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
                    >
                      Ver pedido
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-16">
          <FileText className="mb-4 h-12 w-12 text-gray-300" />
          <p className="font-medium text-gray-500">Nenhuma nota fiscal emitida.</p>
          <p className="mt-1 text-sm text-gray-400">
            As NF-e são geradas a partir de pedidos aprovados.
          </p>
          <Link
            href="/pedidos"
            className="mt-4 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Ver pedidos
          </Link>
        </div>
      )}

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-800" />
            <div className="text-sm text-blue-900">
              <p className="font-medium">Integração SEFAZ</p>
              <p className="mt-1">
                Para emitir NF-e, configure seu token SEFAZ e CNPJ em{" "}
                <Link href="/configuracoes" className="font-medium underline">
                  Configurações
                </Link>
                . A emissão é feita a partir da página de cada pedido aprovado.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
