"use client";

import type { Order, Paginated, Product, StoreSettings } from "@aionix/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, qs } from "./api";

// ---- Types returned by admin endpoints ------------------------------------
export interface AdminProduct extends Product {
  categoryName: string;
  soldCount: number;
  updatedAt: string;
}
export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  imageUrl: string | null;
  sortOrder: number;
  active: boolean;
  productCount: number;
}
export interface AdminPromotion {
  id: string;
  name: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  status: "live" | "scheduled" | "ended" | "paused";
  productIds: string[];
  categoryIds: string[];
  stats: { orders: number; units: number; revenueCents: number; discountCents: number };
}
export interface AdminBanner {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  imageUrl: string | null;
  theme: "forest" | "citrus" | "berry" | "ocean" | "night";
  promotionId: string | null;
  categoryId: string | null;
  sortOrder: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
}
export interface AdminOrder extends Order {
  customerName: string;
  customerPhone: string | null;
}
export interface Dashboard {
  range: string;
  generatedAt: string;
  kpis: {
    revenueCents: number;
    revenueDelta: number;
    orders: number;
    ordersDelta: number;
    avgTicketCents: number;
    avgTicketDelta: number;
    itemsSold: number;
    cancelled: number;
    newCustomers: number;
    activeOrders: number;
  };
  pipeline: Record<string, number>;
  series: { key: string; label: string; revenueCents: number; orders: number }[];
  topProducts: { productId: string | null; name: string; imageUrl: string | null; units: number; revenueCents: number }[];
  lowStock: { id: string; name: string; stock: number; imageUrl: string | null; unitLabel: string }[];
  recentOrders: (Order & { customerName: string })[];
}
export interface MediaItem {
  id: string;
  key: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
  blurDataUrl: string | null;
  createdAt: string;
}
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  orders: number;
  spentCents: number;
  lastOrderAt: string | null;
  clubMember: boolean;
  clubJoinedAt: string | null;
}

// ---- Hooks ------------------------------------------------------------------
export const useDashboard = (range: string) =>
  useQuery({ queryKey: ["admin", "dashboard", range], queryFn: () => api<Dashboard>(`/admin/dashboard${qs({ range })}`), refetchInterval: 60_000 });

export const useActiveOrderCount = () => {
  const q = useQuery({
    queryKey: ["admin", "orders", "active-count"],
    queryFn: () => api<{ total: number }>("/admin/orders?status=active&pageSize=1"),
    refetchInterval: 60_000,
  });
  return q.data?.total ?? 0;
};

export const useAdminOrders = (params: Record<string, string | number | undefined>) =>
  useQuery({
    queryKey: ["admin", "orders", params],
    queryFn: () => api<Paginated<AdminOrder> & { counts: Record<string, number> }>(`/admin/orders${qs(params)}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

export const useAdminOrder = (id: string) =>
  useQuery({ queryKey: ["admin", "order", id], queryFn: () => api<{ order: Order }>(`/admin/orders/${id}`), select: (d) => d.order });

export const useAdminProducts = (params: Record<string, string | number | undefined>) =>
  useQuery({
    queryKey: ["admin", "products", params],
    queryFn: () => api<Paginated<AdminProduct>>(`/admin/products${qs(params)}`),
    placeholderData: keepPreviousData,
  });

export const useAdminCategories = () =>
  useQuery({ queryKey: ["admin", "categories"], queryFn: () => api<{ items: AdminCategory[] }>("/admin/categories"), select: (d) => d.items });

export const useAdminPromotions = () =>
  useQuery({ queryKey: ["admin", "promotions"], queryFn: () => api<{ items: AdminPromotion[] }>("/admin/promotions"), select: (d) => d.items });

export const useAdminBanners = () =>
  useQuery({ queryKey: ["admin", "banners"], queryFn: () => api<{ items: AdminBanner[] }>("/admin/banners"), select: (d) => d.items });

export const useMedia = () =>
  useQuery({ queryKey: ["admin", "media"], queryFn: () => api<{ items: MediaItem[] }>("/admin/media"), select: (d) => d.items });

export const useCustomers = (params: Record<string, string | number | undefined>) =>
  useQuery({ queryKey: ["admin", "customers", params], queryFn: () => api<Paginated<Customer> & { members: number }>(`/admin/customers${qs(params)}`), placeholderData: keepPreviousData });

export const useSettings = () =>
  useQuery({ queryKey: ["admin", "settings"], queryFn: () => api<{ settings: StoreSettings }>("/admin/settings"), select: (d) => d.settings });

/** Generic mutation with cache invalidation + toasts. */
export function useAdminMutation<TVars, TData = unknown>(
  fn: (vars: TVars) => Promise<TData>,
  opts: { invalidate: string[][]; success?: string | ((d: TData) => string); onSuccess?: (d: TData, v: TVars) => void },
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (d, v) => {
      for (const key of opts.invalidate) void qc.invalidateQueries({ queryKey: key });
      if (opts.success) toast.success(typeof opts.success === "function" ? opts.success(d) : opts.success);
      opts.onSuccess?.(d, v);
    },
    onError: (err) => toast.error(err.message),
  });
}
