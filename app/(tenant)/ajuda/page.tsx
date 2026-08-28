import { auth } from "@/lib/auth";
import { AjudaClient } from "./ajuda-client";

export default async function AjudaPage() {
  const session = await auth();
  const role = session?.user?.role ?? "CLIENTE";

  return <AjudaClient role={role} />;
}
