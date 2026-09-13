import type { Metadata } from "next";
import { CustomersScreen } from "@/components/screens/customers";

export const metadata: Metadata = { title: "Clientes" };

export default function CustomersPage() {
  return <CustomersScreen />;
}
