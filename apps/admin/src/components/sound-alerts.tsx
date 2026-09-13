"use client";

import { sound } from "@aionix/sound";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { claimAlert, play, useAdminSound, useSoundBlocked } from "@/lib/sound";

const REMINDER_MS = 120_000;
const PENDING_KEY = ["admin", "orders", "pending-count"];

/**
 * Operator-facing audio duties:
 *  - browsers keep audio locked until a click — say so, instead of silently
 *    missing the next order's bell;
 *  - a soft reminder every 2 min while an order waits for confirmation
 *    (one tab rings, even with several panels open).
 */
export function SoundAlerts() {
  const blocked = useSoundBlocked();
  const qc = useQueryClient();
  // Keeps the pending count fresh (realtime invalidates ["admin", "orders"] too).
  useQuery({ queryKey: PENDING_KEY, queryFn: () => api<{ total: number }>("/admin/orders?status=pending&pageSize=1"), refetchInterval: 60_000 });

  useEffect(() => {
    const t = setInterval(() => {
      const p = useAdminSound.getState();
      const pending = qc.getQueryData<{ total: number }>(PENDING_KEY)?.total ?? 0;
      if (p.enabled && p.reminder && pending > 0 && claimAlert("pending-reminder", REMINDER_MS - 10_000)) play("pendingReminder");
    }, REMINDER_MS);
    return () => clearInterval(t);
  }, [qc]);

  return (
    <AnimatePresence>
      {blocked && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          onClick={() => void sound.unlock().then((ok) => ok && play("toggleOn"))}
          className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-full bg-sidebar py-2.5 pr-4 pl-2.5 text-left text-[13px] font-semibold text-white shadow-[0_16px_40px_-12px_rgb(0_0_0/0.5)]"
        >
          <span className="relative grid size-7 shrink-0 place-items-center rounded-full bg-brand-3/20 text-brand-3">
            <span className="absolute inset-0 animate-ping rounded-full bg-brand-3/25" />
            <BellRing className="relative size-4" />
          </span>
          Clique para ativar o alerta sonoro de novos pedidos
        </motion.button>
      )}
    </AnimatePresence>
  );
}
