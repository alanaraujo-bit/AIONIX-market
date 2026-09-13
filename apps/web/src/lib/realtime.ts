"use client";

import { formatOrderNumber, orderStatusLabel, type OrderStatus } from "@aionix/shared";
import type { SoundName } from "@aionix/sound";
import { play } from "./sound";
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
  fulfillmentMethod?: "delivery" | "pickup";
}

function statusSound(e: OrderEvent): SoundName | null {
  switch (e.status) {
    case "confirmed":
      return "orderConfirmed";
    case "picking":
      return "orderPicking";
    case "out_for_delivery":
      return e.fulfillmentMethod === "pickup" ? "orderReady" : "orderOnTheWay";
    case "delivered":
      return "orderDelivered";
    case "cancelled":
      return "orderCancelled";
    default:
      return null;
  }
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
          void qc.invalidateQueries({ queryKey: ["achievements"] });
          const e = JSON.parse((ev as MessageEvent).data) as OrderEvent;
          void qc.invalidateQueries({ queryKey: ["orders"] });
          void qc.invalidateQueries({ queryKey: ["order", e.orderId] });
          haptic([10, 40, 10]);
          const s = statusSound(e);
          if (s) play(s);
          const onOrderPage = window.location.pathname === `/pedidos/${e.orderId}`;
          if (!onOrderPage) {
            toast(`Pedido ${formatOrderNumber(e.number)}`, {
              description: e.fulfillmentMethod === "pickup" && e.status === "out_for_delivery" ? "Seu pedido está pronto para retirada!" : orderStatusLabel(e.status, e.fulfillmentMethod),
              action: { label: "Ver", href: `/pedidos/${e.orderId}` },
              sound: false,
            });
          }
        });
        es.addEventListener("coins.credited", () => {
          // The wallet decides what to celebrate (unseen entries), so a credit
          // that arrives live and one found on the next visit look the same.
          void qc.invalidateQueries({ queryKey: ["loyalty"] });
          void qc.invalidateQueries({ queryKey: ["me"] });
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
