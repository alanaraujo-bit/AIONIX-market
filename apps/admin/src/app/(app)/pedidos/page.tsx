import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersScreen } from "@/components/screens/orders";

export const metadata: Metadata = { title: "Pedidos" };

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersScreen />
    </Suspense>
  );
}
