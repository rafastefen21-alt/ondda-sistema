import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/*
  Formato esperado do CSV (separador ;):

  email_cliente;produto;quantidade;observacoes
  joao@padaria.com;Pão Francês;100;Entregar pela manhã
  joao@padaria.com;Croissant;50;Entregar pela manhã
  maria@mercado.com;Pão de Forma;30;

  Regras:
  - Linhas com mesmo email_cliente + observacoes  →  mesmo pedido
  - Cabeçalho obrigatório na primeira linha
  - Separador: ponto-e-vírgula (;)
  - Produto identificado pelo nome (case-insensitive, trim)
  - Quantidade: número inteiro ou decimal (vírgula ou ponto)
*/

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "GERENTE", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { tenantId } = session.user;

  const formData = await req.formData();
  const file = formData.get("csv") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Arquivo CSV não enviado." }, { status: 400 });
  }

  const text = await file.text();
  // Normaliza quebras de linha
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV vazio ou sem dados (mínimo: cabeçalho + 1 linha)." }, { status: 400 });
  }

  // Valida cabeçalho
  const header = lines[0].toLowerCase().split(";").map((h) => h.trim());
  const requiredCols = ["email_cliente", "produto", "quantidade"];
  for (const col of requiredCols) {
    if (!header.includes(col)) {
      return NextResponse.json({
        error: `Coluna obrigatória ausente: "${col}". Cabeçalho esperado: email_cliente;produto;quantidade;observacoes`,
      }, { status: 400 });
    }
  }

  const iEmail = header.indexOf("email_cliente");
  const iProd  = header.indexOf("produto");
  const iQty   = header.indexOf("quantidade");
  const iNotes = header.indexOf("observacoes");

  // Pre-load all active products of tenant (for name lookup)
  const allProducts = await prisma.product.findMany({
    where: { tenantId, active: true },
    select: { id: true, name: true, price: true, unit: true },
  });
  const productByName = new Map(allProducts.map((p) => [p.name.toLowerCase().trim(), p]));

  // Pre-load all active clients of tenant
  const allClients = await prisma.user.findMany({
    where: { tenantId, role: "CLIENTE", active: true },
    select: { id: true, email: true, name: true },
  });
  const clientByEmail = new Map(allClients.map((c) => [c.email.toLowerCase().trim(), c]));

  // Parse rows
  interface ParsedRow {
    email: string;
    productName: string;
    quantity: number;
    notes: string;
    lineNum: number;
  }

  const parsedRows: ParsedRow[] = [];
  const rowErrors: { line: number; msg: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    const email = (cols[iEmail] ?? "").trim().toLowerCase();
    const productName = (cols[iProd] ?? "").trim();
    const qtyStr = (cols[iQty] ?? "").trim().replace(",", ".");
    const notes = iNotes >= 0 ? (cols[iNotes] ?? "").trim() : "";

    if (!email) { rowErrors.push({ line: i + 1, msg: "email_cliente vazio" }); continue; }
    if (!productName) { rowErrors.push({ line: i + 1, msg: "produto vazio" }); continue; }
    const qty = parseFloat(qtyStr);
    if (isNaN(qty) || qty <= 0) {
      rowErrors.push({ line: i + 1, msg: `quantidade inválida: "${qtyStr}"` });
      continue;
    }

    parsedRows.push({ email, productName, quantity: qty, notes, lineNum: i + 1 });
  }

  // Group rows into orders: key = email + "|||" + notes
  const groups = new Map<string, ParsedRow[]>();
  for (const row of parsedRows) {
    const key = `${row.email}|||${row.notes}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // Create orders
  const created: { orderId: string; clientName: string; itemCount: number }[] = [];
  const skipped: { key: string; reason: string }[] = [];

  for (const [key, rows] of groups) {
    const [email, notes] = key.split("|||");
    const client = clientByEmail.get(email);
    if (!client) {
      skipped.push({ key: email, reason: `cliente não encontrado: ${email}` });
      continue;
    }

    const items: { productId: string; quantity: number; unitPrice: number }[] = [];
    for (const row of rows) {
      const product = productByName.get(row.productName.toLowerCase());
      if (!product) {
        rowErrors.push({ line: row.lineNum, msg: `produto não encontrado: "${row.productName}"` });
        continue;
      }
      items.push({ productId: product.id, quantity: row.quantity, unitPrice: Number(product.price) });
    }

    if (items.length === 0) {
      skipped.push({ key: email, reason: "nenhum produto válido nos itens" });
      continue;
    }

    const order = await prisma.order.create({
      data: {
        tenantId,
        clientId: client.id,
        status:   "PENDENTE_APROVACAO",
        notes:    notes || null,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity:  item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
    });

    created.push({ orderId: order.id, clientName: client.name ?? email, itemCount: items.length });
  }

  return NextResponse.json({
    ordersCreated: created.length,
    rowErrors: rowErrors.length,
    skipped: skipped.length,
    created,
    errors: [...rowErrors.map((e) => `Linha ${e.line}: ${e.msg}`), ...skipped.map((s) => s.reason)],
  }, { status: 201 });
}

// GET — devolve um CSV de exemplo para download
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { tenantId } = session.user;

  // Pega até 3 clientes e 3 produtos reais do tenant para o exemplo
  const [clients, products] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: "CLIENTE", active: true },
      select: { email: true, name: true },
      take: 2,
    }),
    prisma.product.findMany({
      where: { tenantId, active: true },
      select: { name: true, unit: true },
      take: 3,
    }),
  ]);

  const c1 = clients[0]?.email ?? "cliente1@email.com";
  const c2 = clients[1]?.email ?? "cliente2@email.com";
  const p1 = products[0]?.name ?? "Pão Francês";
  const p2 = products[1]?.name ?? "Croissant";
  const p3 = products[2]?.name ?? "Pão de Forma";

  const csv = [
    "email_cliente;produto;quantidade;observacoes",
    `${c1};${p1};100;Entregar pela manhã`,
    `${c1};${p2};50;Entregar pela manhã`,
    `${c2};${p3};30;`,
    `${c2};${p1};200;`,
  ].join("\r\n");

  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("filename") ?? "modelo-importacao-pedidos.csv";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
