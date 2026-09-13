"use client";

import type { Address, AddressInput, Order } from "@aionix/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { MeData, OrderListItem } from "./types";

export function useMe(enabled = true) {
  return useQuery({ queryKey: ["me"], queryFn: () => api<MeData>("/me"), enabled });
}

export function useAddresses(enabled = true) {
  return useQuery({
    queryKey: ["addresses"],
    queryFn: () => api<{ items: Address[] }>("/me/addresses"),
    enabled,
    select: (d) => d.items,
  });
}

export function useAddressMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["addresses"] });
  const save = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: AddressInput }) =>
      id
        ? api<{ address: Address }>(`/me/addresses/${id}`, { method: "PUT", body: input })
        : api<{ address: Address }>("/me/addresses", { body: input }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/me/addresses/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
  const setDefault = useMutation({
    mutationFn: (id: string) => api(`/me/addresses/${id}/default`, { method: "POST" }),
    onSuccess: invalidate,
  });
  return { save, remove, setDefault };
}

export function useOrders(enabled = true) {
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => api<{ items: OrderListItem[]; total: number }>("/me/orders?pageSize=50"),
    enabled,
    refetchInterval: 45_000,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: () => api<{ order: Order }>(`/me/orders/${id}`),
    select: (d) => d.order,
    refetchInterval: (q) => {
      const s = q.state.data?.order.status;
      return s && s !== "delivered" && s !== "cancelled" ? 30_000 : false;
    },
  });
}
