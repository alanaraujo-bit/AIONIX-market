import type { Metadata } from "next";
import { SoundsScreen } from "@/components/screens/sounds";

export const metadata: Metadata = { title: "Sons" };

export default function SoundsPage() {
  return <SoundsScreen />;
}
