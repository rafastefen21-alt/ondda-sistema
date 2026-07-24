/**
 * GET /api/pagamentos/{id}/boleto
 *
 * Gera o PDF do boleto Itaú (padrão FEBRABAN) a partir da linha digitável e do
 * código de barras salvos na cobrança.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { renderBoletoPdfById } from "@/lib/boleto-pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const pdf = await renderBoletoPdfById(id, session.user.tenantId);
  if (!pdf) {
    return NextResponse.json(
      { error: "Este pagamento não tem boleto Itaú registrado." },
      { status: 400 },
    );
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="boleto-${id}.pdf"`,
    },
  });
}
