import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { ClienteForm } from "../../cliente-form";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(role)) redirect("/clientes");

  const { id } = await params;

  const client = await prisma.user.findFirst({
    where: { id, tenantId, role: "CLIENTE" },
  });

  if (!client) notFound();

  return (
    <ClienteForm
      mode="edit"
      client={{
        id:              client.id,
        name:            client.name            ?? "",
        email:           client.email,
        phone:           client.phone           ?? "",
        cnpj:            client.cnpj,
        cpf:             client.cpf,
        cep:             client.cep,
        logradouro:      client.logradouro,
        numero:          client.numero,
        complemento:     client.complemento,
        bairro:          client.bairro,
        city:            client.city,
        state:           client.state,
        codigoCidade:    client.codigoCidade,
        financeiroNome:  client.financeiroNome,
        financeiroEmail: client.financeiroEmail,
        financeiroPhone: client.financeiroPhone,
        decisorNome:     client.decisorNome,
        decisorEmail:    client.decisorEmail,
        decisorPhone:    client.decisorPhone,
        observacoes:     client.observacoes,
        active:          client.active,
      }}
    />
  );
}
