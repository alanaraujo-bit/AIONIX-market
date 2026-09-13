"use client";

import type { LoginInput, PublicUser, RegisterInput } from "@aionix/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export function useSession() {
  const q = useQuery({
    queryKey: ["session"],
    queryFn: () => api<{ user: PublicUser | null }>("/auth/session"),
    staleTime: 5 * 60_000,
  });
  return { user: q.data?.user ?? null, loading: q.isPending, refetch: q.refetch };
}

export function useAuthActions() {
  const qc = useQueryClient();
  const onAuthed = (data: { user: PublicUser }) => {
    qc.setQueryData(["session"], { user: data.user });
    void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "session" && q.queryKey[0] !== "catalog" });
  };
  const login = useMutation({
    mutationFn: (input: LoginInput) => api<{ user: PublicUser }>("/auth/login", { body: input }),
    onSuccess: onAuthed,
  });
  const register = useMutation({
    mutationFn: (input: RegisterInput) => api<{ user: PublicUser }>("/auth/register", { body: input }),
    onSuccess: onAuthed,
  });
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.setQueryData(["session"], { user: null });
      qc.removeQueries({ predicate: (q) => ["me", "orders", "order", "addresses", "quote", "loyalty"].includes(String(q.queryKey[0])) });
    },
  });
  return { login, register, logout };
}
