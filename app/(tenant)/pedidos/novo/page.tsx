import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NovoPedidoClient } from "./novo-pedido-client";

// Monta o endereço do cliente numa linha, pulando partes vazias.
function formatClientAddress(c: {
  logradouro: string | null; numero: string | null; complemento: string | null;
  bairro: string | null; city: string | null; state: string | null; cep: string | null;
}): string {
  const rua = [c.logradouro, c.numero].filter(Boolean).join(", ");
  const linha1 = [rua, c.complemento].filter(Boolean).join(" - ");
  const cidadeUf = [c.city, c.state].filter(Boolean).join("/");
  const cep = c.cep ? `CEP ${c.cep}` : "";
  return [linha1, c.bairro, cidadeUf, cep].filter(Boolean).join(" - ");
}

export default async function NovoPedidoPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "SUPER_ADMIN", "GERENTE"].includes(role)) {
    redirect("/pedidos");
  }

  const [clients, products] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, active: true },
      select: {
        id: true, name: true, nomeFantasia: true, email: true, role: true,
        logradouro: true, numero: true, complemento: true,
        bairro: true, city: true, state: true, cep: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { tenantId, active: true },
      include: { category: { select: { name: true } } },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  return (
    <NovoPedidoClient
      clients={clients.map((c) => ({
        id: c.id,
        name: c.nomeFantasia ?? c.name,
        email: c.email,
        role: c.role,
        address: formatClientAddress(c),
      }))}
      products={products.map((p) => ({
        id:          p.id,
        name:        p.name,
        price:       Number(p.price),
        pricePacote: p.pricePacote ? Number(p.pricePacote) : null,
        priceCaixa:  p.priceCaixa  ? Number(p.priceCaixa)  : null,
        labelPacote: p.labelPacote ?? null,
        labelCaixa:  p.labelCaixa  ?? null,
        unit:        p.unit,
        category:    p.category?.name ?? null,
      }))}
      role={role}
    />
  );
}
