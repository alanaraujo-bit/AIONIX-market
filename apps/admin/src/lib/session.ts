"use client";

import type { PublicUser } from "@aionix/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export function useSession() {
  const q = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: PublicUser | null }>("/auth/session"),
    staleTime: 5 * 60_000,
  });
  const user = q.data?.user && q.data.user.role === "admin" ? q.data.user : null;
  return { user, loading: q.isPending };
}

export function useAuth() {
  const qc = useQueryClient();
  const login = useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api<{ user: PublicUser }>("/auth/login", { body: { ...input, scope: "admin" } }),
    onSuccess: (d) => qc.setQueryData(["session"], { user: d.user }),
  });
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSuccess: () => qc.clear(),
  });
  return { login, logout };
}
