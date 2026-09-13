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

export type FulfillmentMethod = "delivery" | "pickup";

/**
 * Both methods share the same steps. For pickup, `out_for_delivery` means
 * "separado, pronto para retirada" — the moment the customer can come — and
 * `delivered` means "retirado na loja".
 */
export function orderFlow(_fulfillmentMethod: FulfillmentMethod = "delivery"): OrderStatus[] {
  return ORDER_FLOW;
}

const PICKUP_LABEL: Partial<Record<OrderStatus, string>> = { out_for_delivery: "Pronto para retirada", delivered: "Retirado na loja" };
const PICKUP_SHORT: Partial<Record<OrderStatus, string>> = { out_for_delivery: "Pronto", delivered: "Retirado" };

/** Status label that speaks the right language for delivery vs. pickup. */
export function orderStatusLabel(status: OrderStatus, fulfillmentMethod: FulfillmentMethod = "delivery"): string {
  return (fulfillmentMethod === "pickup" && PICKUP_LABEL[status]) || ORDER_STATUS_LABEL[status];
}

export function orderStatusShort(status: OrderStatus, fulfillmentMethod: FulfillmentMethod = "delivery"): string {
  return (fulfillmentMethod === "pickup" && PICKUP_SHORT[status]) || ORDER_STATUS_SHORT[status];
}

export function nextOrderStatus(status: OrderStatus, fulfillmentMethod: "delivery" | "pickup" = "delivery"): OrderStatus | null {
  const flow = orderFlow(fulfillmentMethod);
  const i = flow.indexOf(status);
  if (i < 0 || i >= flow.length - 1) return null;
  return flow[i + 1] ?? null;
}

export function canTransition(from: OrderStatus, to: OrderStatus, fulfillmentMethod: "delivery" | "pickup" = "delivery"): boolean {
  if (from === "delivered" || from === "cancelled") return false;
  if (to === "cancelled") return true;
  return nextOrderStatus(from, fulfillmentMethod) === to;
}

export const PAYMENT_METHODS = ["pix", "card_on_delivery", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  card_on_delivery: "Cartão na entrega",
  cash: "Dinheiro",
};

// ---- Loyalty (coins) --------------------------------------------------------
export const REWARD_TYPES = ["discount_fixed", "discount_percent", "free_delivery", "product", "gift"] as const;
export type RewardType = (typeof REWARD_TYPES)[number];
export const REWARD_TYPE_LABEL: Record<RewardType, string> = {
  discount_fixed: "Desconto em R$",
  discount_percent: "Desconto em %",
  free_delivery: "Frete grátis",
  product: "Produto grátis",
  gift: "Brinde / prêmio na loja",
};

export const COIN_ENTRY_TYPES = ["earn", "bonus", "redeem", "refund", "adjust", "reversal"] as const;
export type CoinEntryType = (typeof COIN_ENTRY_TYPES)[number];
export const COIN_ENTRY_STATUSES = ["pending", "settled", "void"] as const;
export type CoinEntryStatus = (typeof COIN_ENTRY_STATUSES)[number];

export const REDEMPTION_STATUSES = ["available", "applied", "used", "cancelled"] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];
export const REDEMPTION_STATUS_LABEL: Record<RedemptionStatus, string> = {
  available: "Disponível",
  applied: "Em um pedido",
  used: "Utilizado",
  cancelled: "Cancelado",
};

/** When earned coins become spendable. */
export const AWARD_ON = ["created", "confirmed", "delivered"] as const;
export type AwardOn = (typeof AWARD_ON)[number];
export const AWARD_ON_LABEL: Record<AwardOn, string> = {
  created: "Assim que o pedido é feito",
  confirmed: "Quando a loja confirma o pedido",
  delivered: "Quando o pedido é entregue",
};
