"use client";

import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { forwardRef, useEffect } from "react";
import { createPortal } from "react-dom";

export const cn = clsx;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center gap-2 font-semibold whitespace-nowrap transition-[background-color,box-shadow,transform] duration-150 outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-3/60",
        {
          "bg-brand text-white hover:bg-brand-2": variant === "primary",
          "bg-line-2 text-ink hover:bg-line": variant === "secondary",
          "bg-transparent text-ink-2 hover:bg-line-2": variant === "ghost",
          "bg-card text-ink ring-1 ring-line hover:bg-line-2/60": variant === "outline",
          "bg-sale-soft text-sale hover:bg-[#fbd9d3]": variant === "danger",
          "h-8 rounded-lg px-3 text-[13px]": size === "sm",
          "h-10 rounded-xl px-4 text-[14px]": size === "md",
          "h-12 rounded-xl px-5 text-[15px]": size === "lg",
          "size-9 rounded-lg": size === "icon",
        },
        className,
      )}
      {...props}
    >
      <span className={cn("inline-flex items-center gap-2", loading && "opacity-0")}>{children}</span>
      {loading && <Loader2 className="absolute size-4 animate-spin" />}
    </button>
  );
});

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string; prefix?: string; suffix?: string };
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, prefix, suffix, className, ...props }, ref) {
  return (
    <label className={cn("block", className)}>
      {label && <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">{label}</span>}
      <span className={cn("flex h-10 items-center rounded-xl bg-card ring-1 transition-shadow focus-within:ring-2", error ? "ring-sale focus-within:ring-sale" : "ring-line focus-within:ring-brand-3")}>
        {prefix && <span className="pl-3 text-[13.5px] font-semibold text-muted">{prefix}</span>}
        <input ref={ref} className="h-full min-w-0 flex-1 bg-transparent px-3 text-[14px] outline-none placeholder:text-faint disabled:text-muted" {...props} />
        {suffix && <span className="pr-3 text-[13px] font-medium text-muted">{suffix}</span>}
      </span>
      {(error || hint) && <span className={cn("mt-1 block text-[12px] font-medium", error ? "text-sale" : "text-muted")}>{error ?? hint}</span>}
    </label>
  );
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string };
export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <label className={cn("block", className)}>
      {label && <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">{label}</span>}
      <textarea className={cn("w-full rounded-xl bg-card px-3 py-2.5 text-[14px] ring-1 outline-none focus:ring-2", error ? "ring-sale" : "ring-line focus:ring-brand-3")} {...props} />
      {error && <span className="mt-1 block text-[12px] font-medium text-sale">{error}</span>}
    </label>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string };
export function Select({ label, error, className, children, ...props }: SelectProps) {
  return (
    <label className={cn("block", className)}>
      {label && <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">{label}</span>}
      <select className={cn("h-10 w-full rounded-xl bg-card px-3 text-[14px] ring-1 outline-none focus:ring-2", error ? "ring-sale" : "ring-line focus:ring-brand-3")} {...props}>
        {children}
      </select>
      {error && <span className="mt-1 block text-[12px] font-medium text-sale">{error}</span>}
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className="inline-flex items-center gap-2.5 disabled:opacity-50"
    >
      <span className={cn("relative h-6 w-11 rounded-full transition-colors", checked ? "bg-brand" : "bg-line")}>
        <motion.span layout className="absolute top-0.5 size-5 rounded-full bg-white shadow" style={{ left: checked ? 22 : 2 }} transition={{ type: "spring", stiffness: 600, damping: 32 }} />
      </span>
      {label && <span className="text-[13.5px] font-medium text-ink-2">{label}</span>}
    </button>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "brand" | "sale" | "citrus" | "info" | "ink" | "club"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] leading-[18px] font-bold whitespace-nowrap",
        {
          "bg-line-2 text-ink-2": tone === "neutral",
          "bg-brand-soft text-brand": tone === "brand",
          "bg-sale-soft text-sale": tone === "sale",
          "bg-citrus-soft text-[#8a5a00]": tone === "citrus",
          "bg-info-soft text-info": tone === "info",
          "bg-ink text-white": tone === "ink",
          "bg-club-soft text-club": tone === "club",
        },
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ children, className, title, action, padded = true }: { children: React.ReactNode; className?: string; title?: React.ReactNode; action?: React.ReactNode; padded?: boolean }) {
  return (
    <section className={cn("rounded-2xl bg-card shadow-card ring-1 ring-line/60", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line-2 px-5 py-3.5">
          {title && <h3 className="font-display text-[15.5px] font-bold tracking-[-0.01em]">{title}</h3>}
          {action}
        </header>
      )}
      <div className={padded ? "p-5" : undefined}>{children}</div>
    </section>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} aria-hidden />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[26px] font-bold tracking-[-0.03em]">{title}</h1>
        {description && <p className="mt-1 text-[14px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">{icon}</span>
      <p className="font-display text-[17px] font-bold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13.5px] text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Right-side drawer for create/edit forms. */
export function Drawer({ open, onClose, title, children, footer, width = "max-w-xl" }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%", transition: { type: "tween", duration: 0.2, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: "spring", stiffness: 420, damping: 42 }}
            className={cn("relative flex h-full w-full flex-col bg-canvas shadow-pop", width)}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-line bg-card px-6 py-4">
              <h2 className="font-display text-[18px] font-bold tracking-[-0.02em]">{title}</h2>
              <Button variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}>
                <X className="size-5" />
              </Button>
            </header>
            <div className="scroll-y min-h-0 flex-1 px-6 py-5">{children}</div>
            {footer && <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-card px-6 py-4">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirmar", tone = "danger", loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description?: string; confirmLabel?: string; tone?: "danger" | "primary"; loading?: boolean }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
          <motion.div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div role="alertdialog" initial={{ opacity: 0, scale: 0.94, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="relative w-full max-w-sm rounded-2xl bg-card p-6 shadow-pop">
            <h2 className="font-display text-[18px] font-bold tracking-[-0.02em]">{title}</h2>
            {description && <p className="mt-2 text-[14px] leading-relaxed text-muted">{description}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button variant={tone} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function fieldErrors(details?: { path: string; message: string }[]) {
  const out: Record<string, string> = {};
  for (const d of details ?? []) if (!out[d.path]) out[d.path] = d.message;
  return out;
}

/** Parses "12,90" / "12.90" into cents. */
export function parseMoney(s: string): number {
  const n = Number(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
export function moneyInput(cents: number | null | undefined): string {
  return cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}
