import type { Metadata } from "next";
import { BannersScreen } from "@/components/screens/banners";

export const metadata: Metadata = { title: "Banners" };

export default function BannersPage() {
  return <BannersScreen />;
}
