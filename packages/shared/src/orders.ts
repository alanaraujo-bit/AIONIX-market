export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "picking",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Pedido confirmado",
  picking: "Em separação",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const ORDER_STATUS_SHORT: Record<OrderStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  picking: "Separando",
  out_for_delivery: "Em rota",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

/** Linear fulfillment flow; cancellation is allowed from any non-final state. */
export const ORDER_FLOW: OrderStatus[] = ["pending", "confirmed", "picking", "out_for_delivery", "delivered"];

export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  const i = ORDER_FLOW.indexOf(status);
  if (i < 0 || i >= ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[i + 1] ?? null;
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === "delivered" || from === "cancelled") return false;
  if (to === "cancelled") return true;
  return ORDER_FLOW.indexOf(to) === ORDER_FLOW.indexOf(from) + 1;
}

export const PAYMENT_METHODS = ["pix", "card_on_delivery", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  card_on_delivery: "Cartão na entrega",
  cash: "Dinheiro",
};
