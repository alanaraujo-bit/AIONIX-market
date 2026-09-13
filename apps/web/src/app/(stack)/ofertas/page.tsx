import type { Metadata } from "next";
import { DealsScreen } from "@/components/screens/deals-screen";

export const metadata: Metadata = { title: "Ofertas" };

export default function DealsPage() {
  return <DealsScreen />;
}
