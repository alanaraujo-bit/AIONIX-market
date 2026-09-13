import type { Metadata } from "next";
import { AchievementsScreen } from "@/components/screens/achievements";

export const metadata: Metadata = { title: "Conquistas" };
export default function AchievementsPage() { return <AchievementsScreen />; }
