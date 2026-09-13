"use client";

import { ORDER_STATUS_SHORT, type OrderStatus } from "@aionix/shared";
import { Check, ClipboardCheck, PackageSearch, PartyPopper, Truck, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "./ui";

export const STATUS_ICON: Record<OrderStatus, LucideIcon> = {
  pending: ClipboardCheck,
  confirmed: Check,
  picking: PackageSearch,
  out_for_delivery: Truck,
  delivered: PartyPopper,
  cancelled: XCircle,
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  pending: "bg-citrus-soft text-[#8a5a00]",
  confirmed: "bg-info-soft text-info",
  picking: "bg-brand-soft text-brand-2",
  out_for_delivery: "bg-brand text-white",
  delivered: "bg-line-2 text-ink-2",
  cancelled: "bg-sale-soft text-sale",
};

export function StatusPill({ status, className }: { status: OrderStatus; className?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold whitespace-nowrap", STATUS_TONE[status], className)}>
      <Icon className="size-3.5" strokeWidth={2.5} />
      {ORDER_STATUS_SHORT[status]}
    </span>
  );
}
