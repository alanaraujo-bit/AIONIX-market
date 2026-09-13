import type { Metadata } from "next";
import { PromotionsScreen } from "@/components/screens/promotions";

export const metadata: Metadata = { title: "Promoções" };

export default function PromotionsPage() {
  return <PromotionsScreen />;
}
