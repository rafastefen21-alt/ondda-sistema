import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { LojaClient } from "./loja-client";

// ── Open Graph / WhatsApp preview ────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug, active: true },
    select: { name: true, slug: true, lojaLogoUrl: true, lojaBannerUrl: true, lojaDescricao: true },
  });

  if (!tenant) return {};

  const title       = `${tenant.name} — Faça seu pedido`;
  const description = tenant.lojaDescricao ?? `Pedidos online para ${tenant.name}. Rápido e fácil.`;
  // WhatsApp usa og:image — preferência: logo, fallback: banner
  const image       = tenant.lojaLogoUrl ?? tenant.lojaBannerUrl ?? null;
  const url         = `https://ondda-sistema.vercel.app/loja/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: tenant.name,
      type: "website",
      ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: tenant.name }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function LojaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug, active: true },
    select: {
      id: true, name: true, slug: true,
      lojaCorPrimaria: true, lojaBannerUrl: true,
      lojaLogoUrl: true, lojaDescricao: true, lojaPedidoMinimo: true,
    },
  });

  if (!tenant) notFound();

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId: tenant.id, active: true },
      include: { category: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.productCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <LojaClient
      tenant={{
        name: tenant.name,
        slug: tenant.slug,
        corPrimaria: tenant.lojaCorPrimaria ?? "#f59e0b",
        bannerUrl: tenant.lojaBannerUrl ?? null,
        logoUrl: tenant.lojaLogoUrl ?? null,
        descricao: tenant.lojaDescricao ?? null,
        pedidoMinimo: tenant.lojaPedidoMinimo ? Number(tenant.lojaPedidoMinimo) : 0,
      }}
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        unit: p.unit,
        minQuantity: p.minQuantity ? Number(p.minQuantity) : undefined,
        shelfLifeDays: p.shelfLifeDays ?? null,
        weightGrams: p.weightGrams ?? null,
        diameterCm: p.diameterCm ? Number(p.diameterCm) : null,
        pricePacote: p.pricePacote ? Number(p.pricePacote) : null,
        priceCaixa: p.priceCaixa ? Number(p.priceCaixa) : null,
        labelPacote: p.labelPacote ?? null,
        labelCaixa: p.labelCaixa ?? null,
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? null,
        imageUrl: p.imageUrl ?? null,
      }))}
      categories={categories}
    />
  );
}
