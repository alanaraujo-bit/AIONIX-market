import type { Metadata } from "next";
import { WalletScreen } from "@/components/screens/wallet-screen";

export const metadata: Metadata = { title: "Minhas moedas" };

export default function WalletPage() {
  return <WalletScreen />;
}
