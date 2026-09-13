import { EventEmitter } from "node:events";
import type { OrderStatus } from "@aionix/shared";

export interface OrderEventPayload {
  type: "order.created" | "order.updated";
  orderId: string;
  userId: string;
  number: number;
  status: OrderStatus;
  totalCents: number;
  at: string;
}

/** Coins were credited to (or taken from) a shopper's wallet. */
export interface CoinsEventPayload {
  type: "coins.credited";
  userId: string;
  coins: number;
  balance: number;
  orderId: string | null;
  number: number | null;
  note: string | null;
  at: string;
}

export type EventPayload = OrderEventPayload | CoinsEventPayload;

const bus = new EventEmitter();
bus.setMaxListeners(0);

export function publish(event: EventPayload) {
  bus.emit("event", event);
}

export function subscribe(listener: (e: EventPayload) => void) {
  bus.on("event", listener);
  return () => bus.off("event", listener);
}
