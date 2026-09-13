import type { Metadata } from "next";
import { CategoryScreen } from "@/components/screens/category-screen";
import { serverGet } from "@/lib/server-api";
import type { Category } from "@/lib/types";

async function getCategory(slug: string) {
  const data = await serverGet<{ items: Category[] }>("/categories", 60);
  return data?.items.find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategory(slug);
  return { title: cat?.name ?? "Categoria" };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await getCategory(slug);
  return <CategoryScreen slug={slug} category={category} />;
}
