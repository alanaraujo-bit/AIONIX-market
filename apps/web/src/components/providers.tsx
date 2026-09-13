"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { RealtimeBridge } from "@/lib/realtime";
import { AchievementCelebration } from "@/components/achievements/achievement-celebration";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.9 }}>
        {children}
        <RealtimeBridge />
        <AchievementCelebration />
      </MotionConfig>
    </QueryClientProvider>
  );
}
