import { HomeScreen } from "@/components/screens/home-screen";
import { serverGet } from "@/lib/server-api";
import type { HomeData } from "@/lib/types";

export const revalidate = 30;

export default async function HomePage() {
  const initial = await serverGet<HomeData>("/catalog/home", 30);
  return <HomeScreen initial={initial} />;
}
