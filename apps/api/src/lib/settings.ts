import type { StoreSettings } from "@aionix/shared";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "AIONIX Market",
  deliveryFeeCents: 990,
  freeDeliveryThresholdCents: 15000,
  minimumOrderCents: 3000,
  storeOpen: true,
  etaMinutes: 45,
};

let cached: { at: number; value: StoreSettings } | null = null;

export async function getSettings(): Promise<StoreSettings> {
  if (cached && Date.now() - cached.at < 15_000) return cached.value;
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, "store")).limit(1);
  const value = { ...DEFAULT_SETTINGS, ...((row?.value as Partial<StoreSettings>) ?? {}) };
  cached = { at: Date.now(), value };
  return value;
}

export async function saveSettings(value: StoreSettings) {
  await db
    .insert(schema.settings)
    .values({ key: "store", value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
  cached = null;
  return value;
}
