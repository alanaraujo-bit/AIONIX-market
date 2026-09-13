"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useToasts } from "@/lib/toast";

const icons = {
  default: <Info className="size-[18px] text-white/80" />,
  success: <CheckCircle2 className="size-[18px] text-brand-3" />,
  error: <XCircle className="size-[18px] text-[#ff8a7a]" />,
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+10px)]">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96, transition: { duration: 0.18 } }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.6, bottom: 0 }}
            onDragEnd={(_, info) => info.offset.y < -20 && dismiss(t.id)}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-ink/95 px-4 py-3 text-white shadow-[0_18px_40px_-16px_rgb(0_0_0/0.5)] backdrop-blur-xl"
            role="status"
          >
            <span className="mt-px shrink-0">{icons[t.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-snug font-semibold">{t.message}</p>
              {t.description && <p className="mt-0.5 text-[13px] leading-snug text-white/65">{t.description}</p>}
            </div>
            {t.action?.href && (
              <Link
                href={t.action.href}
                onClick={() => dismiss(t.id)}
                className="shrink-0 self-center rounded-full bg-white/12 px-3 py-1.5 text-[12.5px] font-semibold"
              >
                {t.action.label}
              </Link>
            )}
            {t.action && !t.action.href && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick?.();
                  dismiss(t.id);
                }}
                className="shrink-0 self-center rounded-full bg-citrus px-3 py-1.5 text-[12.5px] font-bold text-ink"
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
