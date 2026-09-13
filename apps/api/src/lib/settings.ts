import type { LoyaltySettings, StoreSettings } from "@aionix/shared";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client";

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "AIONIX Market",
  pickupEnabled: false,
  pickupAddress: "",
  deliveryFeeCents: 990,
  freeDeliveryThresholdCents: 15000,
  minimumOrderCents: 3000,
  storeOpen: true,
  etaMinutes: 45,
};

/** Loyalty program defaults: 1 coin per R$ 1 in products, credited on delivery, no bonuses. */
export const DEFAULT_LOYALTY: LoyaltySettings = {
  enabled: true,
  coinName: "Moeda",
  coinNamePlural: "Moedas",
  coinEmoji: "🪙",
  earnCoins: 1,
  earnPerCents: 100,
  minOrderCents: 0,
  awardOn: "delivered",
  clubBonusPercent: 0,
  signupBonusCoins: 0,
  firstOrderBonusCoins: 0,
  tagline: "Compre, junte moedas e troque por prêmios.",
};

const cache = new Map<string, { at: number; value: unknown }>();

async function readSetting<T extends object>(key: string, defaults: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 15_000) return hit.value as T;
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
  const value = { ...defaults, ...((row?.value as Partial<T>) ?? {}) };
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function writeSetting<T extends object>(key: string, value: T) {
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
  cache.delete(key);
  return value;
}

export const getSettings = () => readSetting("store", DEFAULT_SETTINGS);
export const saveSettings = (value: StoreSettings) => writeSetting("store", value);
export const getLoyaltySettings = () => readSetting("loyalty", DEFAULT_LOYALTY);
export const saveLoyaltySettings = (value: LoyaltySettings) => writeSetting("loyalty", value);
