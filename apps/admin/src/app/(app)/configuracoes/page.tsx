import type { Metadata } from "next";
import { SettingsScreen } from "@/components/screens/settings";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsPage() {
  return <SettingsScreen />;
}
