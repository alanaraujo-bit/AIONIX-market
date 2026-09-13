import type { Metadata } from "next";
import { OrderDetailScreen } from "@/components/screens/order-detail-screen";

export const metadata: Metadata = { title: "Detalhes do pedido" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailScreen id={id} />;
}
