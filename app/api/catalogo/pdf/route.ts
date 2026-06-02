import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Document, Page, Text, View, Image, StyleSheet,
  renderToBuffer, Font,
} from "@react-pdf/renderer";
import React from "react";

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 32,
    paddingVertical: 36,
    fontFamily: "Helvetica",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: "#1e3a8a",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerLogo: { width: 48, height: 48, borderRadius: 8, objectFit: "cover" },
  headerName: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#1e3a8a" },
  headerSub: { fontSize: 9, color: "#64748b", marginTop: 2 },
  headerDate: { fontSize: 8, color: "#94a3b8", textAlign: "right" },

  // Category title
  categoryTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a8a",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    marginTop: 16,
    marginBottom: 8,
  },

  // Product grid — 2 columns
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  // Product card
  card: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  cardImage: { width: "100%", height: 100, objectFit: "cover" },
  cardImagePlaceholder: {
    width: "100%",
    height: 100,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  cardImagePlaceholderText: { fontSize: 28, color: "#cbd5e1" },
  cardBody: { padding: 8 },
  cardName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#0f172a", marginBottom: 3 },
  cardDesc: { fontSize: 8, color: "#64748b", marginBottom: 6, lineHeight: 1.4 },

  // Prices
  pricesRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  priceBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  priceLabel: { fontSize: 6.5, color: "#3b82f6", marginBottom: 1 },
  priceValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1e40af" },

  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
  footerText: { fontSize: 7.5, color: "#94a3b8" },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(n: number) {
  return `R$ ${n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function today() {
  return new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  pricePacote: number | null;
  labelPacote: string | null;
  priceCaixa: number | null;
  labelCaixa: string | null;
  imageUrl: string | null;
  categoryName: string | null;
}

interface TenantInfo {
  name: string;
  logoUrl: string | null;
}

function CatalogoPDF({ tenant, products }: { tenant: TenantInfo; products: ProductRow[] }) {
  // Agrupar por categoria
  const grouped = new Map<string, ProductRow[]>();
  for (const p of products) {
    const cat = p.categoryName ?? "Sem categoria";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(p);
  }

  return React.createElement(
    Document,
    { title: `Catálogo — ${tenant.name}`, author: tenant.name },
    React.createElement(
      Page,
      { size: "A4", style: styles.page },

      // ── Header ──
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          { style: styles.headerLeft },
          tenant.logoUrl
            ? React.createElement(Image, { src: tenant.logoUrl, style: styles.headerLogo })
            : null,
          React.createElement(
            View,
            null,
            React.createElement(Text, { style: styles.headerName }, tenant.name),
            React.createElement(Text, { style: styles.headerSub }, "Catálogo de Produtos"),
          ),
        ),
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.headerDate }, `Gerado em ${today()}`),
          React.createElement(Text, { style: styles.headerDate }, `${products.length} produto(s)`),
        ),
      ),

      // ── Categorias + produtos ──
      ...Array.from(grouped.entries()).flatMap(([category, prods]) => [
        // Título da categoria
        React.createElement(Text, { key: `cat-${category}`, style: styles.categoryTitle }, category),

        // Grid de produtos
        React.createElement(
          View,
          { key: `grid-${category}`, style: styles.grid },
          ...prods.map((p) =>
            React.createElement(
              View,
              { key: p.id, style: styles.card },

              // Imagem ou placeholder
              p.imageUrl
                ? React.createElement(Image, { src: p.imageUrl, style: styles.cardImage })
                : React.createElement(
                    View,
                    { style: styles.cardImagePlaceholder },
                    React.createElement(Text, { style: styles.cardImagePlaceholderText }, "🍞"),
                  ),

              // Corpo do card
              React.createElement(
                View,
                { style: styles.cardBody },
                React.createElement(Text, { style: styles.cardName }, p.name),
                p.description
                  ? React.createElement(Text, { style: styles.cardDesc }, p.description)
                  : null,

                // Preços
                React.createElement(
                  View,
                  { style: styles.pricesRow },

                  // Unidade
                  React.createElement(
                    View,
                    { style: styles.priceBadge },
                    React.createElement(Text, { style: styles.priceLabel }, p.unit),
                    React.createElement(Text, { style: styles.priceValue }, fmtBRL(p.price)),
                  ),

                  // Pacote
                  p.pricePacote && p.labelPacote
                    ? React.createElement(
                        View,
                        { style: styles.priceBadge },
                        React.createElement(Text, { style: styles.priceLabel }, p.labelPacote),
                        React.createElement(Text, { style: styles.priceValue }, fmtBRL(p.pricePacote)),
                      )
                    : null,

                  // Caixa
                  p.priceCaixa && p.labelCaixa
                    ? React.createElement(
                        View,
                        { style: styles.priceBadge },
                        React.createElement(Text, { style: styles.priceLabel }, p.labelCaixa),
                        React.createElement(Text, { style: styles.priceValue }, fmtBRL(p.priceCaixa)),
                      )
                    : null,
                ),
              ),
            ),
          ),
        ),
      ]),

      // ── Footer ──
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(Text, { style: styles.footerText }, tenant.name),
        React.createElement(
          Text,
          { style: styles.footerText, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `Página ${pageNumber} de ${totalPages}` },
        ),
      ),
    ),
  );
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!["TENANT_ADMIN", "SUPER_ADMIN", "GERENTE"].includes(session.user.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { tenantId } = session.user;

  const [tenant, products] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, lojaLogoUrl: true },
    }),
    prisma.product.findMany({
      where: { tenantId, active: true },
      include: { category: { select: { name: true } } },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  if (!tenant) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

  const productRows: ProductRow[] = products.map((p) => ({
    id:          p.id,
    name:        p.name,
    description: p.description,
    price:       Number(p.price),
    unit:        p.unit,
    pricePacote: p.pricePacote ? Number(p.pricePacote) : null,
    labelPacote: p.labelPacote,
    priceCaixa:  p.priceCaixa  ? Number(p.priceCaixa)  : null,
    labelCaixa:  p.labelCaixa,
    imageUrl:    p.imageUrl ?? null,
    categoryName: p.category?.name ?? null,
  }));

  const element = React.createElement(CatalogoPDF, {
    tenant: { name: tenant.name, logoUrl: tenant.lojaLogoUrl ?? null },
    products: productRows,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  const buffer = await renderToBuffer(element);

  const filename = `catalogo-${tenant.name.toLowerCase().replace(/\s+/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
