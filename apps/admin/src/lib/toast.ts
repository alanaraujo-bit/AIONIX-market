"use client";

import { sound, type SoundName } from "@aionix/sound";
import { toast as sonner, type ExternalToast } from "sonner";

/**
 * Sonner with a themed sound per tone: success/error/warning ring their kit
 * sound, plain toasts stay silent unless a `sound` is given. `sound: false`
 * silences one that already has its own sound (e.g. the new-order bell).
 */
type Message = Parameters<typeof sonner>[0];
type Opts = ExternalToast & { sound?: SoundName | false };

const make =
  (fallback: SoundName | false, show: (m: Message, o?: ExternalToast) => string | number) =>
  (message: Message, opts: Opts = {}) => {
    const { sound: s = fallback, ...rest } = opts;
    if (s) sound.play(s);
    return show(message, rest);
  };

export const toast = Object.assign(
  make(false, (m, o) => sonner(m, o)),
  {
    success: make("success", sonner.success),
    error: make("error", sonner.error),
    warning: make("warning", sonner.warning),
    info: make("notify", sonner.info),
    dismiss: sonner.dismiss,
  },
);
