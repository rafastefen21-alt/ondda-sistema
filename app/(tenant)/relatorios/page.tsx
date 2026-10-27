import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hojeBr, normalizarPeriodo, relatorioClientes, relatorioProdutos } from "@/lib/relatorios";
import { RelatoriosClient } from "./relatorios-client";

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; aba?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  const { de, ate, aba } = await searchParams;
  const periodo = normalizarPeriodo(de, ate);
  const [clientes, produtos] = await Promise.all([
    relatorioClientes(session.user.tenantId, periodo),
    relatorioProdutos(session.user.tenantId, periodo),
  ]);

  return (
    <RelatoriosClient
      aba={aba === "produtos" ? "produtos" : "clientes"}
      clientes={clientes}
      produtos={produtos}
      hoje={hojeBr()}
    />
  );
}
