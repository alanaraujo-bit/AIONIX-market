import type { Metadata } from "next";
import { OrderDetailScreen } from "@/components/screens/order-detail";

export const metadata: Metadata = { title: "Pedido" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailScreen id={id} />;
}
