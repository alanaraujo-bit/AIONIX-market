"use client";

import type { FulfillmentMethod, OrderStatus } from "@aionix/shared";
import { sound, type SoundName, type SoundParams } from "@aionix/sound";
import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Panel-side glue for the shared AIONIX sound kit. Preferences are per
 * browser (the operator's machine), not per store.
 */
interface AdminSoundPrefs {
  enabled: boolean;
  volume: number;
  /** Soft reminder while an order waits for confirmation. */
  reminder: boolean;
  setEnabled: (v: boolean) => void;
  setVolume: (v: number) => void;
  setReminder: (v: boolean) => void;
}

export const useAdminSound = create<AdminSoundPrefs>()(
  persist(
    (set) => ({
      enabled: true,
      volume: 0.8,
      reminder: true,
      setEnabled: (enabled) => {
        sound.setEnabled(enabled);
        set({ enabled });
        if (enabled) sound.play("toggleOn", {}, { preview: true });
      },
      setVolume: (volume) => {
        sound.setVolume(volume);
        set({ volume });
      },
      setReminder: (reminder) => set({ reminder }),
    }),
    {
      name: "aionix-admin-sound-v1",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (s) => {
        sound.setEnabled(s?.enabled ?? true);
        sound.setVolume(s?.volume ?? 0.8);
      },
    },
  ),
);

export function play(name: SoundName, params?: SoundParams) {
  return sound.play(name, params);
}

/** The sound of an order reaching a status (the same ones the shopper hears). */
export function statusSound(status: OrderStatus, method?: FulfillmentMethod | null): SoundName {
  switch (status) {
    case "confirmed":
      return "orderConfirmed";
    case "picking":
      return "orderPicking";
    case "out_for_delivery":
      return method === "pickup" ? "orderReady" : "orderOnTheWay";
    case "delivered":
      return "orderDelivered";
    case "cancelled":
      return "orderCancelled";
    default:
      return "success";
  }
}

/** Keeps audio unlocked on every gesture; mount once in the shell. */
export function useSoundBridge() {
  useEffect(() => {
    const { enabled, volume } = useAdminSound.getState();
    sound.setEnabled(enabled);
    sound.setVolume(volume);
    return sound.attach({ eager: true });
  }, []);
}

/** True while sounds are on but the browser still waits for a first click. */
export function useSoundBlocked() {
  return useSyncExternalStore(
    (cb) => sound.subscribe(cb),
    () => sound.blocked,
    () => false,
  );
}

/**
 * Alerts reach every open panel tab; only one should ring. The first tab to
 * claim the key within the window plays, the others stay quiet.
 */
export function claimAlert(key: string, windowMs = 4000): boolean {
  try {
    const k = `aionix-alert:${key}`;
    const now = Date.now();
    const prev = Number(localStorage.getItem(k) ?? 0);
    if (now - prev < windowMs) return false;
    localStorage.setItem(k, String(now));
    return true;
  } catch {
    return true;
  }
}
