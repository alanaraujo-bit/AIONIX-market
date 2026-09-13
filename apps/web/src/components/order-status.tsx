"use client";

import { ORDER_FLOW, ORDER_STATUS_LABEL, ORDER_STATUS_SHORT, type OrderEvent, type OrderStatus } from "@aionix/shared";
import { Check, ClipboardCheck, PackageSearch, PartyPopper, Truck, XCircle, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "./ui/primitives";

const ICONS: Record<OrderStatus, LucideIcon> = {
  pending: ClipboardCheck,
  confirmed: Check,
  picking: PackageSearch,
  out_for_delivery: Truck,
  delivered: PartyPopper,
  cancelled: XCircle,
};

export function StatusPill({ status, size = "sm" }: { status: OrderStatus; size?: "sm" | "md" }) {
  const Icon = ICONS[status];
  const tone =
    status === "delivered"
      ? "bg-brand-soft text-brand"
      : status === "cancelled"
        ? "bg-sale-soft text-sale"
        : status === "out_for_delivery"
          ? "bg-[#e3ecfa] text-[#1f4f9c]"
          : "bg-citrus-soft text-[#8a5a00]";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full font-bold", tone, size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3 py-1.5 text-[13px]")}>
      {status !== "cancelled" && status !== "delivered" && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} strokeWidth={2.4} />
      {ORDER_STATUS_SHORT[status]}
    </span>
  );
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).replace(".", "");

/** Vertical stepper of the fulfillment flow, annotated with real event timestamps. */
export function OrderTimeline({ status, events = [] }: { status: OrderStatus; events?: OrderEvent[] }) {
  const cancelled = status === "cancelled";
  const currentIndex = cancelled ? ORDER_FLOW.indexOf(events.filter((e) => e.status !== "cancelled").at(-1)?.status ?? "pending") : ORDER_FLOW.indexOf(status);
  const eventFor = (s: OrderStatus) => events.filter((e) => e.status === s).at(-1);
  const steps: OrderStatus[] = cancelled ? [...ORDER_FLOW.slice(0, currentIndex + 1), "cancelled"] : ORDER_FLOW;

  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const Icon = ICONS[s];
        const done = cancelled ? s !== "cancelled" || true : i <= currentIndex;
        const active = cancelled ? s === "cancelled" : i === currentIndex;
        const ev = eventFor(s);
        const isLast = i === steps.length - 1;
        return (
          <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && (
              <span className="absolute top-9 bottom-0 left-[17px] w-0.5 rounded bg-line">
                {(cancelled ? true : i < currentIndex) && (
                  <motion.span initial={{ height: 0 }} animate={{ height: "100%" }} transition={{ duration: 0.5, delay: i * 0.12 }} className={cn("block w-full rounded", s === "cancelled" ? "bg-sale" : "bg-brand-3")} />
                )}
              </span>
            )}
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.1, type: "spring", stiffness: 400, damping: 22 }}
              className={cn(
                "relative z-10 grid size-9 shrink-0 place-items-center rounded-full ring-4 ring-canvas",
                s === "cancelled" ? "bg-sale text-white" : done ? "bg-brand text-white" : "bg-line-2 text-faint",
                active && s !== "cancelled" && "shadow-[0_0_0_6px_rgb(31_154_103/0.18)]",
              )}
            >
              <Icon className="size-4" strokeWidth={2.5} />
            </motion.span>
            <div className="min-w-0 pt-1.5">
              <p className={cn("text-[14.5px] font-bold tracking-[-0.01em]", done ? "text-ink" : "text-faint")}>{ORDER_STATUS_LABEL[s]}</p>
              {ev ? (
                <p className="mt-0.5 text-[12.5px] font-medium text-muted">
                  {fmtTime(ev.createdAt)}
                  {ev.note ? ` · ${ev.note}` : ""}
                </p>
              ) : active ? (
                <p className="mt-0.5 text-[12.5px] font-medium text-brand-2">Em andamento</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
