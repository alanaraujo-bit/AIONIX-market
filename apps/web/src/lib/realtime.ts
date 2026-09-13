"use client";

import { formatOrderNumber, ORDER_STATUS_LABEL, type OrderStatus } from "@aionix/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "./api";
import { useSession } from "./session";
import { haptic, toast } from "./toast";

interface OrderEvent {
  type: "order.created" | "order.updated";
  orderId: string;
  number: number;
  status: OrderStatus;
}

/**
 * Keeps an SSE connection to the API while signed in. The API is on another
 * origin, so we first fetch a short-lived ticket through the same-origin proxy.
 */
export function RealtimeBridge() {
  const { user } = useSession();
  const qc = useQueryClient();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let attempts = 0;

    const connect = async () => {
      try {
        const { ticket, url } = await api<{ ticket: string; url: string }>("/realtime/ticket");
        if (cancelled) return;
        es = new EventSource(`${url}?ticket=${encodeURIComponent(ticket)}`);
        es.addEventListener("ready", () => {
          attempts = 0;
        });
        es.addEventListener("order.updated", (ev) => {
          const e = JSON.parse((ev as MessageEvent).data) as OrderEvent;
          void qc.invalidateQueries({ queryKey: ["orders"] });
          void qc.invalidateQueries({ queryKey: ["order", e.orderId] });
          haptic([10, 40, 10]);
          const onOrderPage = window.location.pathname === `/pedidos/${e.orderId}`;
          if (!onOrderPage) {
            toast(`Pedido ${formatOrderNumber(e.number)}`, {
              description: ORDER_STATUS_LABEL[e.status],
              action: { label: "Ver", href: `/pedidos/${e.orderId}` },
            });
          }
        });
        es.addEventListener("order.created", () => {
          void qc.invalidateQueries({ queryKey: ["orders"] });
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
    const onVisible = () => {
      if (document.visibilityState === "visible" && !es && !cancelled) {
        clearTimeout(timer);
        void connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      es?.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, qc]);

  return null;
}
