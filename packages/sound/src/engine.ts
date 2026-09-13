import { SOUNDS, type SoundDef, type SoundName, type SoundParams } from "./catalog";
import { Voices } from "./voices";

/**
 * Mastering bus shared by every sound:
 *
 *   group ─► high-pass 90 Hz ─► high-shelf −4 dB @ 6.5 kHz ─► low-pass 9 kHz ─┐
 *     └─► send ─► high-pass 320 Hz ─► small-room convolution reverb ──────────┴─► compressor ─► master
 *
 * The EQ removes rumble and the brittle top that makes synthesized sounds feel
 * cheap; the soft compressor keeps the whole kit at one loudness and makes
 * clipping impossible even when sounds overlap.
 */
export interface Bus {
  input: GainNode;
  send: GainNode;
  master: GainNode;
}

/** Output level at volume 1.0. The offline lab measures the kit against it. */
export const MASTER_LEVEL = 0.92;

function impulse(ctx: BaseAudioContext, seconds = 0.9): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let s = 0x9e37 + ch * 7919, lp = 0;
    for (let i = 0; i < len; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const t = i / len;
      // Darken over time (one-pole low-pass gets heavier) like air absorbing highs.
      const k = 0.35 + t * 0.55;
      lp = lp * k + (s / 0xffffffff - 0.5) * (1 - k);
      const fadeIn = Math.min(1, i / (ctx.sampleRate * 0.006));
      d[i] = lp * 2.4 * fadeIn * Math.pow(1 - t, 3.4);
    }
  }
  return b;
}

export function buildBus(ctx: BaseAudioContext, dest: AudioNode): Bus {
  const input = ctx.createGain();
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 90;
  const shelf = ctx.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 6500;
  shelf.gain.value = -4;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 9000;
  lp.Q.value = 0.5;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.004;
  comp.release.value = 0.22;

  const send = ctx.createGain();
  const verbHp = ctx.createBiquadFilter();
  verbHp.type = "highpass";
  verbHp.frequency.value = 320;
  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.85;

  const master = ctx.createGain();
  master.gain.value = MASTER_LEVEL;

  input.connect(hp).connect(shelf).connect(lp).connect(comp);
  send.connect(verbHp).connect(verb).connect(wet).connect(comp);
  comp.connect(master).connect(dest);
  return { input, send, master };
}

/** Schedules one sound into a bus; returns its group so it can be ducked. */
export function renderInto(ctx: BaseAudioContext, bus: Bus, name: SoundName, params: SoundParams, t0: number, rand?: () => number): GainNode {
  const def: SoundDef = SOUNDS[name];
  const group = ctx.createGain();
  group.connect(bus.input);
  const send = ctx.createGain();
  send.gain.value = def.space;
  group.connect(send).connect(bus.send);
  def.render(new Voices(ctx, group, t0, rand), params);
  return group;
}

/** Deterministic offline render — used by the sound lab to measure the kit. */
export async function renderOffline(name: SoundName, params: SoundParams = {}, { sampleRate = 44100, seconds = 3.2 } = {}): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * seconds), sampleRate);
  const bus = buildBus(ctx, ctx.destination);
  let seed = 12345;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  renderInto(ctx, bus, name, params, 0.01, rand);
  return ctx.startRendering();
}

type Listener = () => void;

/** Last sounds actually played (window.__aionixSounds) — lets E2E tests assert what the user heard. */
function trace(name: SoundName) {
  const w = window as unknown as { __aionixSounds?: string[] };
  (w.__aionixSounds ??= []).push(name);
  if (w.__aionixSounds.length > 50) w.__aionixSounds.shift();
}

/**
 * Browser singleton. Nothing touches WebAudio until the first user gesture
 * (autoplay policy), and every call is a silent no-op when audio isn't
 * available — sounds can never break a screen.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private bus: Bus | null = null;
  private analyser: AnalyserNode | null = null;
  private enabled = true;
  private volume = 0.8;
  private gestured = false;
  private last: { name: SoundName; prio: number; at: number; group: GainNode } | null = null;
  private lastByName = new Map<SoundName, number>();
  private listeners = new Set<Listener>();

  private create(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC({ latencyHint: "interactive" });
      this.ctx = ctx;
      this.bus = buildBus(ctx, ctx.destination);
      this.applyVolume(0);
      ctx.onstatechange = () => this.emit();
      return ctx;
    } catch {
      return null;
    }
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  /** Call from any user gesture; safe to call repeatedly (iOS re-suspends after interruptions). */
  unlock(): Promise<boolean> {
    this.gestured = true;
    const ctx = this.create();
    this.emit();
    if (!ctx) return Promise.resolve(false);
    if (ctx.state === "running") return Promise.resolve(true);
    return ctx.resume().then(
      () => (this.emit(), this.ready),
      () => false,
    );
  }

  /** Installs gesture + visibility listeners that keep audio unlocked. Returns a cleanup. */
  attach({ eager = false }: { eager?: boolean } = {}): () => void {
    if (typeof window === "undefined") return () => {};
    // Eager: try to start right away — browsers that remember this site's
    // engagement allow it, so a restored panel session hears the next order.
    if (eager) {
      const ctx = this.create();
      if (ctx && ctx.state !== "running") void ctx.resume().catch(() => {});
    }
    const onGesture = () => {
      if (!this.ctx || this.ctx.state !== "running") this.unlock();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && this.gestured && this.ctx && this.ctx.state !== "running") void this.ctx.resume().catch(() => {});
    };
    const opts = { capture: true, passive: true } as const;
    window.addEventListener("pointerdown", onGesture, opts);
    window.addEventListener("keydown", onGesture, opts);
    window.addEventListener("touchend", onGesture, opts);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pointerdown", onGesture, opts);
      window.removeEventListener("keydown", onGesture, opts);
      window.removeEventListener("touchend", onGesture, opts);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }

  /** True when a sound would actually be heard right now. */
  get ready() {
    return !!this.ctx && this.ctx.state === "running";
  }

  /** Sounds are on but the browser is still waiting for a first click. */
  get blocked() {
    return this.enabled && !this.ready;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    this.emit();
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume(0.05);
  }

  private applyVolume(ramp: number) {
    if (!this.ctx || !this.bus) return;
    // Perceptual curve: the slider's middle sounds like "half as loud".
    const target = MASTER_LEVEL * Math.pow(this.volume, 1.7);
    this.bus.master.gain.setTargetAtTime(target, this.ctx.currentTime, Math.max(0.001, ramp));
  }

  /** Live analyser on the output, for visualisations. */
  getAnalyser(): AnalyserNode | null {
    const ctx = this.create();
    if (!ctx || !this.bus) return null;
    if (!this.analyser) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.7;
      this.bus.master.connect(this.analyser);
    }
    return this.analyser;
  }

  /**
   * Plays a sound. Rules that keep the platform tasteful:
   *  - off when the user turned sounds off (previews excepted);
   *  - background tabs stay silent except for alerts (priority 5);
   *  - within 120 ms only a more important sound can replace the previous
   *    one (it's ducked), so one gesture never produces two sounds;
   *  - the same sound can't retrigger faster than 45 ms.
   */
  play(name: SoundName, params: SoundParams = {}, opts: { preview?: boolean } = {}): boolean {
    try {
      if (!opts.preview && !this.enabled) return false;
      const def: SoundDef = SOUNDS[name];
      if (!def || typeof document === "undefined") return false;
      if (!opts.preview && def.priority < 5 && document.visibilityState === "hidden") return false;
      const ctx = this.ctx;
      if (!ctx || !this.bus) return false;
      if (ctx.state !== "running") {
        if (this.gestured) void ctx.resume().catch(() => {});
        return false;
      }
      const now = ctx.currentTime;
      // Order news never doubles (local action + its realtime echo); everything
      // else may repeat quickly — adding two products in a row rings twice.
      const news = def.category === "pedidos" || def.category === "painel";
      const prev = this.lastByName.get(name);
      if (prev !== undefined && now - prev < (news ? 1.5 : 0.045)) return false;
      const last = this.last;
      if (last && last.name !== name && now - last.at < 0.12) {
        if (def.priority <= last.prio) return false;
        last.group.gain.setTargetAtTime(0, now, 0.02);
      }
      const group = renderInto(ctx, this.bus, name, params, now + 0.005);
      this.last = { name, prio: def.priority, at: now, group };
      this.lastByName.set(name, now);
      trace(name);
      return true;
    } catch {
      return false;
    }
  }
}

export const sound = new SoundEngine();
