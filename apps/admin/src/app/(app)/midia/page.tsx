import type { Metadata } from "next";
import { MediaScreen } from "@/components/screens/media";

export const metadata: Metadata = { title: "Mídia" };

export default function MediaPage() {
  return <MediaScreen />;
}
