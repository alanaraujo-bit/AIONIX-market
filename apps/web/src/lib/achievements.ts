"use client";

import type { MyAchievements } from "@aionix/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useSession } from "./session";

export function useAchievements() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["achievements", user?.id],
    queryFn: ({ signal }) => api<MyAchievements>("/me/achievements", { signal }),
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
