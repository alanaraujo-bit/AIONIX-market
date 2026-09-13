import type { Metadata } from "next";
import { AddressesScreen } from "@/components/screens/addresses-screen";

export const metadata: Metadata = { title: "Endereços" };

export default function AddressesPage() {
  return <AddressesScreen />;
}
