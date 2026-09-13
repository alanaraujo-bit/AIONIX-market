import { describe, expect, it, vi } from "vitest";
import { canTransition, checkoutSchema, nextOrderStatus, orderStatusLabel, orderStatusShort, settingsSchema } from "@aionix/shared";
vi.mock("../db/client", () => ({ db: {}, schema: {} }));
vi.mock("./settings", () => ({ getSettings: vi.fn() }));
const { buildQuote } = await import("./pricing");
const product = { id: "p", categoryId: "c", name: "Arroz", imageUrl: null, unitLabel: "un", stock: 10, priceCents: 5000, compareAtCents: null, clubPriceCents: null };
const settings = { deliveryFeeCents: 990, freeDeliveryThresholdCents: 15000, minimumOrderCents: 3000 };
const checkout = { items: [{ productId: "00000000-0000-4000-8000-000000000001", quantity: 1 }], paymentMethod: "pix", deliverySlot: "O quanto antes" };

describe("store pickup", () => {
  it("charges delivery normally but never charges shipping for pickup", () => {
    const delivery = buildQuote(new Map([["p", 1]]), [product], [], settings);
    const pickup = buildQuote(new Map([["p", 1]]), [product], [], settings, { fulfillmentMethod: "pickup" });
    expect(delivery.totalCents).toBe(5990);
    expect(pickup.deliveryFeeCents).toBe(0);
    expect(pickup.totalCents).toBe(5000);
    expect(pickup.minimumOrderCents).toBe(3000);
  });
  it("allows pickup without a personal address but still requires it for delivery", () => {
    expect(checkoutSchema.safeParse({ ...checkout, fulfillmentMethod: "pickup" }).success).toBe(true);
    expect(checkoutSchema.safeParse(checkout).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...checkout, fulfillmentMethod: "drone" }).success).toBe(false);
  });
  it("pickup has a 'ready for pickup' step before the customer collects it", () => {
    expect(nextOrderStatus("picking", "pickup")).toBe("out_for_delivery");
    expect(nextOrderStatus("out_for_delivery", "pickup")).toBe("delivered");
    expect(canTransition("picking", "delivered", "pickup")).toBe(false);
    expect(canTransition("confirmed", "delivered", "pickup")).toBe(false);
    expect(canTransition("out_for_delivery", "delivered", "pickup")).toBe(true);
    expect(canTransition("delivered", "cancelled", "pickup")).toBe(false);
    expect(canTransition("out_for_delivery", "cancelled", "pickup")).toBe(true);
  });
  it("labels pickup steps in pickup language and leaves delivery untouched", () => {
    expect(orderStatusLabel("out_for_delivery", "pickup")).toBe("Pronto para retirada");
    expect(orderStatusLabel("delivered", "pickup")).toBe("Retirado na loja");
    expect(orderStatusLabel("out_for_delivery", "delivery")).toBe("Saiu para entrega");
    expect(orderStatusShort("out_for_delivery", "pickup")).toBe("Pronto");
    expect(orderStatusLabel("picking", "pickup")).toBe("Em separação");
  });
  it("requires a real configured location before enabling pickup", () => {
    const base = { ...settings, storeName: "Mercado", storeOpen: true, etaMinutes: 45 };
    expect(settingsSchema.safeParse({ ...base, pickupEnabled: true }).success).toBe(false);
    expect(settingsSchema.parse(base).pickupEnabled).toBe(false);
    expect(settingsSchema.safeParse({ ...base, pickupEnabled: true, pickupAddress: "Rua das Flores, 100, Centro, São Paulo" }).success).toBe(true);
  });
});
