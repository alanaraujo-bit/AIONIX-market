import type { Metadata } from "next";
import { CategoriesScreen } from "@/components/screens/categories";

export const metadata: Metadata = { title: "Categorias" };

export default function CategoriesPage() {
  return <CategoriesScreen />;
}
