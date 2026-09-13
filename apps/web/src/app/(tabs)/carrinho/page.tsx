import type { Metadata } from "next";
import { CartScreen } from "@/components/screens/cart-screen";

export const metadata: Metadata = { title: "Carrinho" };

export default function CartPage() {
  return <CartScreen />;
}
