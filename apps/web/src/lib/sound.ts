"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Tiny synthesized sound kit (no audio assets, works offline). Everything is
 * short, soft and pitched in a friendly major/pentatonic register — feedback,
 * not fanfare. The AudioContext is only created/resumed after a user gesture.
 */

interface SoundPrefs {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

export const useSoundPrefs = create<SoundPrefs>()(
  persist((set) => ({ enabled: true, setEnabled: (enabled) => set({ enabled }) }), {
    name: "aionix-sound-v1",
    storage: createJSONStorage(() => localStorage),
  }),
);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a global pointer/key listener so later programmatic sounds are allowed to play. */
export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});
  unlocked = true;
}

export function canPlay() {
  return unlocked && useSoundPrefs.getState().enabled && !!ctx && ctx.state === "running";
}

interface Tone {
  freq: number;
  at: number;
  dur: number;
  gain?: number;
  type?: OscillatorType;
  /** Pitch glide target (Hz) reached by the end of the note. */
  glide?: number;
}

function play(tones: Tone[], opts: { shimmer?: boolean } = {}) {
  if (!canPlay() || !ctx || !master) return;
  const t0 = ctx.currentTime + 0.01;
  for (const t of tones) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.setValueAtTime(t.freq, t0 + t.at);
    if (t.glide) osc.frequency.exponentialRampToValueAtTime(t.glide, t0 + t.at + t.dur);
    const peak = t.gain ?? 0.11;
    g.gain.setValueAtTime(0.0001, t0 + t.at);
    g.gain.exponentialRampToValueAtTime(peak, t0 + t.at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t.at + t.dur);
    osc.connect(g).connect(master);
    osc.start(t0 + t.at);
    osc.stop(t0 + t.at + t.dur + 0.05);
    if (opts.shimmer) {
      // A quiet octave-up partial makes the coin sound "metallic" without harshness.
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = "triangle";
      o2.frequency.setValueAtTime(t.freq * 2, t0 + t.at);
      g2.gain.setValueAtTime(0.0001, t0 + t.at);
      g2.gain.exponentialRampToValueAtTime(peak * 0.28, t0 + t.at + 0.01);
      g2.gain.exponentialRampToValueAtTime(0.0001, t0 + t.at + t.dur * 0.6);
      o2.connect(g2).connect(master);
      o2.start(t0 + t.at);
      o2.stop(t0 + t.at + t.dur);
    }
  }
}

// Pentatonic ladder (C major) — any subset sounds pleasant together.
const LADDER = [1046.5, 1174.7, 1318.5, 1568.0, 1760.0, 2093.0, 2349.3, 2637.0];

export const sfx = {
  /** One coin: the classic two-note "ding" (B5 → E6). */
  coin(offset = 0) {
    play(
      [
        { freq: 987.8, at: offset, dur: 0.09, gain: 0.1 },
        { freq: 1318.5, at: offset + 0.075, dur: 0.42, gain: 0.12 },
      ],
      { shimmer: true },
    );
  },
  /** Many coins landing: rising pentatonic cascade, count scales with the amount. */
  cascade(count: number) {
    const n = Math.max(3, Math.min(9, Math.round(Math.sqrt(count) + 1)));
    const tones: Tone[] = [];
    for (let i = 0; i < n; i++) {
      const freq = LADDER[Math.min(LADDER.length - 1, i)]!;
      tones.push({ freq, at: i * 0.055, dur: 0.28, gain: 0.07 + i * 0.006 });
    }
    // Resolving chord: warm, short, quiet.
    const end = n * 0.055 + 0.06;
    tones.push({ freq: 1046.5, at: end, dur: 0.75, gain: 0.07 }, { freq: 1318.5, at: end, dur: 0.75, gain: 0.06 }, { freq: 1568.0, at: end + 0.02, dur: 0.75, gain: 0.055 });
    play(tones, { shimmer: true });
  },
  /** Reward unlocked: soft major swell. */
  success() {
    play([
      { freq: 783.99, at: 0, dur: 0.22, gain: 0.08 },
      { freq: 987.77, at: 0.09, dur: 0.24, gain: 0.08 },
      { freq: 1174.66, at: 0.18, dur: 0.5, gain: 0.09 },
      { freq: 1567.98, at: 0.27, dur: 0.6, gain: 0.07 },
    ]);
  },
  /** Light tap acknowledgement. */
  pop() {
    play([{ freq: 520, at: 0, dur: 0.07, gain: 0.05, type: "triangle", glide: 760 }]);
  },
  /** Something slid/whooshed into place. */
  whoosh() {
    play([{ freq: 300, at: 0, dur: 0.16, gain: 0.03, type: "sine", glide: 900 }]);
  },
};
