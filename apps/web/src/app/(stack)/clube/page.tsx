import type { Metadata } from "next";
import { ClubScreen } from "@/components/screens/club-screen";

export const metadata: Metadata = { title: "Clube AIONIX" };

export default function ClubPage() {
  return <ClubScreen />;
}
