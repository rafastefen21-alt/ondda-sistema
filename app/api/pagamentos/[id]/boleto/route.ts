/**
 * GET /api/pagamentos/{id}/boleto
 *
 * Gera o PDF do boleto Itaú (padrão FEBRABAN) a partir da linha digitável e do
 * código de barras salvos na cobrança.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Document, Page, Text, View, StyleSheet, Svg, Rect, renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import { barrasI25 } from "@/lib/boleto";
import { montarIdBeneficiario, ITAU_CARTEIRA } from "@/lib/itau";

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", fontSize: 8, color: "#111" },
  bankRow: { flexDirection: "row", alignItems: "flex-end", borderBottomWidth: 2, borderColor: "#000", paddingBottom: 3, marginBottom: 2 },
  bankLogo: { fontSize: 18, fontFamily: "Helvetica-Bold", marginRight: 8 },
  bankCode: { fontSize: 14, fontFamily: "Helvetica-Bold", marginHorizontal: 8, borderLeftWidth: 2, borderRightWidth: 2, borderColor: "#000", paddingHorizontal: 8 },
  linha: { flex: 1, fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "right" },
  titulo: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 4 },
  grid: { borderWidth: 1, borderColor: "#000" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#000" },
  cell: { padding: 4, borderRightWidth: 1, borderColor: "#000" },
  cellLast: { padding: 4 },
  label: { fontSize: 6, color: "#555" },
  value: { fontSize: 9, marginTop: 2 },
  valueB: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 2 },
  corte: { borderTopWidth: 1, borderColor: "#000", borderStyle: "dashed", marginVertical: 12 },
  obs: { fontSize: 7, color: "#666", marginTop: 6 },
});

interface CelProps { label: string; value: string; flex?: number; bold?: boolean; last?: boolean }
function Cel({ label, value, flex = 1, bold, last }: CelProps) {
  return React.createElement(
    View, { style: [last ? styles.cellLast : styles.cell, { flex }] },
    React.createElement(Text, { style: styles.label }, label),
    React.createElement(Text, { style: bold ? styles.valueB : styles.value }, value || "-"),
  );
}

function CodigoBarras({ codigo }: { codigo: string }) {
  let barras;
  try { barras = barrasI25(codigo); } catch { return null; }
  const larguraPt = 380;
  const altura = 44;
  const unidade = larguraPt / barras.total;
  return React.createElement(
    Svg, { width: larguraPt, height: altura, viewBox: `0 0 ${barras.total} ${altura}` },
    ...barras.bars.map((b, i) =>
      React.createElement(Rect, { key: i, x: b.x, y: 0, width: b.w, height: altura, fill: "#000" }),
    ),
  );
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "-";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const pagamento = await prisma.payment.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      order: { include: { client: true } },
      tenant: true,
    },
  });

  if (!pagamento) {
    return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });
  }
  if (!pagamento.itauNossoNumero || !pagamento.codigoBarras) {
    return NextResponse.json(
      { error: "Este pagamento não tem boleto Itaú registrado." },
      { status: 400 },
    );
  }

  const t = pagamento.tenant;
  const c = pagamento.order.client;
  const idBenef = montarIdBeneficiario(t.itauAgencia, t.itauConta, t.itauContaDac) ?? "-";
  const agConta = t.itauAgencia && t.itauConta
    ? `${t.itauAgencia} / ${t.itauConta}-${t.itauContaDac ?? ""}`
    : "-";
  const valor = Number(pagamento.amount);
  const pagadorDoc = c.cnpj || c.cpf || "";
  const pagadorEndereco = [
    [c.logradouro, c.numero].filter(Boolean).join(", "),
    c.bairro, [c.city, c.state].filter(Boolean).join("/"), c.cep,
  ].filter(Boolean).join(" - ");

  const doc = React.createElement(
    Document, {},
    React.createElement(
      Page, { size: "A4", style: styles.page },

      // Cabeçalho banco + linha digitável
      React.createElement(
        View, { style: styles.bankRow },
        React.createElement(Text, { style: styles.bankLogo }, "Itau"),
        React.createElement(Text, { style: styles.bankCode }, "341-7"),
        React.createElement(Text, { style: styles.linha }, pagamento.linhaDigitavel ?? ""),
      ),

      React.createElement(Text, { style: styles.titulo }, "Recibo do Pagador"),

      React.createElement(
        View, { style: styles.grid },
        React.createElement(
          View, { style: styles.row },
          Cel({ label: "Beneficiário", value: t.name, flex: 3 }),
          Cel({ label: "Agência / Código", value: agConta, flex: 1, last: true }),
        ),
        React.createElement(
          View, { style: styles.row },
          Cel({ label: "CNPJ do Beneficiário", value: t.cnpj ?? "-", flex: 2 }),
          Cel({ label: "Nosso Número", value: pagamento.itauNossoNumero, flex: 1 }),
          Cel({ label: "Carteira", value: ITAU_CARTEIRA, flex: 1, last: true }),
        ),
        React.createElement(
          View, { style: styles.row },
          Cel({ label: "Pagador", value: `${c.name ?? c.email}${pagadorDoc ? "  •  " + pagadorDoc : ""}`, flex: 3 }),
          Cel({ label: "Vencimento", value: dt(pagamento.dueDate), flex: 1, bold: true, last: true }),
        ),
        React.createElement(
          View, { style: styles.row },
          Cel({ label: "Endereço do Pagador", value: pagadorEndereco, flex: 3 }),
          Cel({ label: "Valor do Documento", value: brl(valor), flex: 1, bold: true, last: true }),
        ),
        React.createElement(
          View, { style: [styles.row, { borderBottomWidth: 0 }] },
          Cel({ label: "Nº do Pedido", value: `#${pagamento.orderId.slice(-6).toUpperCase()}`, flex: 1, last: true }),
        ),
      ),

      React.createElement(View, { style: styles.corte }),

      // Ficha de compensação (código de barras)
      React.createElement(Text, { style: styles.titulo }, "Ficha de Compensação"),
      React.createElement(Text, { style: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 8 } },
        pagamento.linhaDigitavel ?? ""),
      React.createElement(CodigoBarras, { codigo: pagamento.codigoBarras }),

      (t.itauAmbiente !== "Efetivacao")
        ? React.createElement(Text, { style: styles.obs },
            "⚠ Boleto emitido em ambiente de VALIDAÇÃO (teste) — não é válido para pagamento.")
        : React.createElement(Text, { style: styles.obs },
            "Pague preferencialmente pelo app ou internet banking usando a linha digitável ou o código de barras."),
    ),
  );

  const pdf = await renderToBuffer(doc);
  const arquivo = `boleto-${pagamento.itauNossoNumero}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${arquivo}"`,
    },
  });
}
