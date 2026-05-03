import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProdutoForm } from "../produto-form";

export default async function NovoProdutoPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const { tenantId, role } = session.user;
  if (!["TENANT_ADMIN", "GERENTE"].includes(role)) redirect("/produtos");

  const categories = await prisma.productCategory.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });

  return (
    <ProdutoForm
      categories={categories}
      mode="create"
    />
  );
}
