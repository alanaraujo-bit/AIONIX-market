"use client";

import { sound, type SoundName } from "@aionix/sound";
import { create } from "zustand";

export type ToastTone = "default" | "success" | "error";
export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  /** Themed sound; defaults to success/error by tone, silent for plain toasts. */
  sound?: SoundName | false;
}

interface ToastState {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = ++seq;
    const s = t.sound ?? (t.tone === "success" ? "success" : t.tone === "error" ? "error" : false);
    if (s) sound.play(s);
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => get().dismiss(id), t.tone === "error" ? 4200 : 3000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

type Extra = Partial<Pick<ToastItem, "description" | "action" | "sound">>;
export const toast = Object.assign(
  (message: string, extra?: Extra) => useToasts.getState().push({ message, tone: "default", ...extra }),
  {
    success: (message: string, extra?: Extra) => useToasts.getState().push({ message, tone: "success", ...extra }),
    error: (message: string, extra?: Extra) => useToasts.getState().push({ message, tone: "error", ...extra }),
  },
);

export function haptic(pattern: number | number[] = 8) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* unsupported */
    }
  }
}
