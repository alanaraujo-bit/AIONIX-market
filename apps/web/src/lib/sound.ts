"use client";

import { sound, type SoundName, type SoundParams } from "@aionix/sound";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * App-side glue for the shared AIONIX sound kit (@aionix/sound). The engine
 * is synthesized (no audio files, works offline) and every call is a silent
 * no-op until the first gesture or when the shopper turned sounds off.
 */

interface SoundPrefs {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

export const useSoundPrefs = create<SoundPrefs>()(
  persist(
    (set) => ({
      enabled: true,
      setEnabled: (enabled) => {
        sound.setEnabled(enabled);
        set({ enabled });
        // Turning sounds on answers with a coin, so the shopper hears what they enabled.
        if (enabled) sound.play("coin", {}, { preview: true });
      },
    }),
    {
      name: "aionix-sound-v1",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => sound.setEnabled(state?.enabled ?? true),
    },
  ),
);

/** Plays a themed sound from the kit. */
export function play(name: SoundName, params?: SoundParams) {
  return sound.play(name, params);
}

export function unlockAudio() {
  sound.unlock();
}

/** Shorthands kept for readability at call sites. */
export const sfx = {
  coin: (delay = 0) => (delay ? void setTimeout(() => sound.play("coin"), delay * 1000) : void sound.play("coin")),
  cascade: (count: number) => void sound.play("coinShower", { count }),
  success: () => void sound.play("success"),
  pop: () => void sound.play("tap"),
  play,
};
