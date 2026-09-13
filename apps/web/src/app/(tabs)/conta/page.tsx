import type { Metadata } from "next";
import { AccountScreen } from "@/components/screens/account-screen";

export const metadata: Metadata = { title: "Conta" };

export default function AccountPage() {
  return <AccountScreen />;
}
