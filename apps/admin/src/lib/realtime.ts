"use client";

import { formatBRL, formatOrderNumber, orderStatusShort, type OrderStatus } from "@aionix/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "./api";

interface OrderEvent {
  type: "order.created" | "order.updated";
  orderId: string;
  number: number;
  status: OrderStatus;
  fulfillmentMethod?: "delivery" | "pickup";
  totalCents: number;
}

let audioCtx: AudioContext | null = null;
function chime() {
  try {
    audioCtx ??= new AudioContext();
    const t = audioCtx.currentTime;
    for (const [f, d] of [[880, 0], [1174, 0.12]] as const) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.12, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.35);
      o.connect(g).connect(audioCtx.destination);
      o.start(t + d);
      o.stop(t + d + 0.4);
    }
  } catch {
    /* autoplay blocked */
  }
}

/** Live order feed for the whole admin: invalidates queries and announces new orders. */
export function useAdminRealtime(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let attempts = 0;

    const invalidate = () => {
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "order"] });
      void qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    };

    const connect = async () => {
      try {
        const { ticket, url } = await api<{ ticket: string; url: string }>("/realtime/ticket");
        if (cancelled) return;
        es = new EventSource(`${url}?ticket=${encodeURIComponent(ticket)}`);
        es.addEventListener("ready", () => (attempts = 0));
        es.addEventListener("order.created", (ev) => {
          const e = JSON.parse((ev as MessageEvent).data) as OrderEvent;
          invalidate();
          chime();
          toast.success(`Novo pedido ${formatOrderNumber(e.number)}`, {
            description: formatBRL(e.totalCents),
            action: { label: "Abrir", onClick: () => (window.location.href = `/pedidos/${e.orderId}`) },
            duration: 8000,
          });
        });
        es.addEventListener("order.updated", (ev) => {
          const e = JSON.parse((ev as MessageEvent).data) as OrderEvent;
          invalidate();
          if (e.status === "cancelled") toast.warning(`Pedido ${formatOrderNumber(e.number)} cancelado pelo cliente`);
          else toast(`${formatOrderNumber(e.number)} · ${orderStatusShort(e.status, e.fulfillmentMethod)}`);
        });
        es.onerror = () => {
          es?.close();
          es = null;
          if (!cancelled) timer = setTimeout(connect, Math.min(30_000, 2000 * 2 ** attempts++));
        };
      } catch {
        if (!cancelled) timer = setTimeout(connect, Math.min(30_000, 4000 * 2 ** attempts++));
      }
    };
    void connect();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      es?.close();
    };
  }, [enabled, qc]);
}
