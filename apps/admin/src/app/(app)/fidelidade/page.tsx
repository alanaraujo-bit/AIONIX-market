import type { Metadata } from "next";
import { LoyaltyScreen } from "@/components/screens/loyalty";

export const metadata: Metadata = { title: "Fidelidade" };

export default function LoyaltyPage() {
  return <LoyaltyScreen />;
}
