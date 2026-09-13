import type { Metadata } from "next";
import { OrdersScreen } from "@/components/screens/orders-screen";

export const metadata: Metadata = { title: "Pedidos" };

export default function OrdersPage() {
  return <OrdersScreen />;
}
