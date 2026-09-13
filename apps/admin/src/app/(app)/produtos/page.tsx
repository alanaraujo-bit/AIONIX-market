import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsScreen } from "@/components/screens/products";

export const metadata: Metadata = { title: "Produtos" };

export default function ProductsPage() {
  return (
    <Suspense>
      <ProductsScreen />
    </Suspense>
  );
}
