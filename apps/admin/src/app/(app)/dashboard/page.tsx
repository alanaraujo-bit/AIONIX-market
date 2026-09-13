import type { Metadata } from "next";
import { DashboardScreen } from "@/components/screens/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <DashboardScreen />;
}
