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

const bus = new EventEmitter();
bus.setMaxListeners(0);

export function publish(event: OrderEventPayload) {
  bus.emit("event", event);
}

export function subscribe(listener: (e: OrderEventPayload) => void) {
  bus.on("event", listener);
  return () => bus.off("event", listener);
}
