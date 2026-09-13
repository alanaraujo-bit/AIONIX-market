import type { Metadata } from "next";
import { ProductScreen } from "@/components/screens/product-screen";
import { serverGet } from "@/lib/server-api";
import type { ProductDetail } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await serverGet<ProductDetail>(`/products/${slug}`, 60);
  if (!data) return { title: "Produto" };
  return {
    title: data.product.name,
    description: data.product.description || `${data.product.name} com entrega rápida.`,
    openGraph: data.product.imageUrl ? { images: [data.product.imageUrl] } : undefined,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const initial = await serverGet<ProductDetail>(`/products/${slug}`, 30);
  return <ProductScreen slug={slug} initial={initial} />;
}
