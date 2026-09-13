"use client";

import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { motion, type HTMLMotionProps } from "motion/react";
import { forwardRef } from "react";

export const cn = clsx;

type PressableProps = HTMLMotionProps<"button"> & { scale?: number };

/** Button with native-feeling press feedback. */
export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(function Pressable(
  { scale = 0.96, className, type = "button", ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={props.disabled ? undefined : { scale }}
      transition={{ type: "spring", stiffness: 700, damping: 30 }}
      className={cn("outline-none focus-visible:ring-2 focus-visible:ring-brand-3/60", className)}
      {...props}
    />
  );
});

type ButtonProps = PressableProps & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "citrus";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, block, className, children, disabled, ...props },
  ref,
) {
  return (
    <Pressable
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 font-semibold tracking-[-0.01em] transition-[background-color,opacity,box-shadow] duration-200 disabled:opacity-50",
        {
          "bg-brand text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] active:bg-brand-2": variant === "primary",
          "bg-card text-ink ring-1 ring-line": variant === "secondary",
          "bg-transparent text-ink-2": variant === "ghost",
          "bg-sale-soft text-sale": variant === "danger",
          "bg-citrus text-ink": variant === "citrus",
          "h-9 rounded-xl px-3.5 text-[13.5px]": size === "sm",
          "h-12 rounded-2xl px-5 text-[15px]": size === "md",
          "h-14 rounded-[20px] px-6 text-[16px]": size === "lg",
          "w-full": block,
        },
        className,
      )}
      {...props}
    >
      <span className={cn("flex w-full items-center justify-center gap-2", loading && "opacity-0")}>{children as React.ReactNode}</span>
      {loading && <Loader2 className="absolute size-5 animate-spin" />}
    </Pressable>
  );
});

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} aria-hidden />;
}

export function Badge({
  children,
  tone = "brand",
  className,
}: {
  children: React.ReactNode;
  tone?: "brand" | "sale" | "citrus" | "neutral" | "ink";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-[18px] font-bold tracking-[0.01em]",
        {
          "bg-brand-soft text-brand": tone === "brand",
          "bg-sale text-white": tone === "sale",
          "bg-citrus-soft text-[#8a5a00]": tone === "citrus",
          "bg-line-2 text-ink-2": tone === "neutral",
          "bg-ink text-white": tone === "ink",
        },
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center px-8 py-16 text-center"
    >
      <div className="grain mb-5 grid size-20 place-items-center rounded-[28px] bg-brand-soft text-brand">{icon}</div>
      <h3 className="font-display text-[20px] font-bold tracking-[-0.02em]">{title}</h3>
      {description && <p className="mt-1.5 max-w-[260px] text-[14px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between px-5">
      <h2 className="font-display text-[19px] font-bold tracking-[-0.025em]">{title}</h2>
      {action}
    </div>
  );
}
