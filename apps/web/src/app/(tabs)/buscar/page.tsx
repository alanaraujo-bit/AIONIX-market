import type { Metadata } from "next";
import { SearchScreen } from "@/components/screens/search-screen";
import { serverGet } from "@/lib/server-api";
import type { Category } from "@/lib/types";

export const metadata: Metadata = { title: "Buscar" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; focus?: string }> }) {
  const [{ q, focus }, cats] = await Promise.all([searchParams, serverGet<{ items: Category[] }>("/categories", 60)]);
  return <SearchScreen initialQuery={q ?? ""} autoFocus={focus === "1"} initialCategories={cats?.items ?? null} />;
}
