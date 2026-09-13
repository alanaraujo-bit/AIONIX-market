"use client";

import { sound } from "@aionix/sound";
import { useEffect } from "react";
import { useSoundPrefs } from "@/lib/sound";

/** Keeps WebAudio unlocked on every gesture and in sync with the shopper's preference. */
export function SoundBridge() {
  useEffect(() => {
    sound.setEnabled(useSoundPrefs.getState().enabled);
    return sound.attach();
  }, []);
  return null;
}
