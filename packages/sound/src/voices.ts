/**
 * Synthesis primitives. Everything is built from four timbres that share one
 * tonal home (C major pentatonic), so any two sounds of the kit fit together:
 *
 *  - wood:  marimba-like mallet (fundamental + ~4th partial + a tiny felt click) — warm, organic
 *  - bell:  2-operator FM with a fast-decaying index — bright attack, soft glassy tail
 *  - coin:  inharmonic FM bell — the only metallic voice, reserved for money
 *  - air:   band-passed noise — paper, bags, motion, "whoosh"
 *
 * Voices never touch the destination: they write into a per-sound group that
 * the engine routes through its mastering bus (EQ → compressor → master) plus
 * a reverb send.
 */

export const NOTE = {
  C3: 130.81, G3: 196.0,
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760.0,
  C7: 2093.0, D7: 2349.32, E7: 2637.02, G7: 3135.96,
} as const;

/** Pentatonic ladder from C5 — used by anything that "climbs" (quantity, cascades). */
export const LADDER = [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6, NOTE.D6, NOTE.E6, NOTE.G6, NOTE.A6, NOTE.C7, NOTE.D7, NOTE.E7];

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseBuffers.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.2), ctx.sampleRate);
    const d = b.getChannelData(0);
    // Seeded so offline renders are reproducible; pink-ish (one-pole) for a softer hiss.
    let s = 0x2f6b, last = 0;
    for (let i = 0; i < d.length; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const white = s / 0xffffffff - 0.5;
      last = last * 0.62 + white * 0.38;
      d[i] = last * 2.2;
    }
    noiseBuffers.set(ctx, b);
  }
  return b;
}

export interface VoiceOpts {
  /** Seconds after the sound's start. */
  at: number;
  gain: number;
  /** Stereo position −1..1. */
  pan?: number;
}

export class Voices {
  constructor(
    readonly ctx: BaseAudioContext,
    private readonly out: AudioNode,
    private readonly t0: number,
    private readonly rand: () => number = Math.random,
  ) {}

  /** Tiny pitch humanisation (cents) so repeated taps never sound like a machine gun. */
  private cents(spread: number) {
    return (this.rand() - 0.5) * 2 * spread;
  }

  private sink(pan?: number): AudioNode {
    if (!pan || !("createStereoPanner" in this.ctx)) return this.out;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(this.out);
    return p;
  }

  /** Exponential-feeling envelope: soft attack, natural decay, never a click. */
  private env(param: AudioParam, start: number, peak: number, attack: number, dur: number) {
    param.setValueAtTime(0, start);
    param.linearRampToValueAtTime(peak, start + attack);
    param.setTargetAtTime(0, start + attack, Math.max(0.008, (dur - attack) / 4.2));
  }

  private osc(type: OscillatorType, freq: number, start: number, stop: number, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    o.detune.value = detune;
    o.start(start);
    o.stop(stop);
    return o;
  }

  /** Marimba-ish mallet. `dur` is the audible ring. */
  wood({ f, at, gain, dur = 0.22, pan, human = 6, bright = 1 }: VoiceOpts & { f: number; dur?: number; human?: number; bright?: number }) {
    const s = this.t0 + at;
    const out = this.sink(pan);
    const dt = this.cents(human);
    const body = this.ctx.createGain();
    this.env(body.gain, s, gain, 0.0025, dur);
    this.osc("sine", f, s, s + dur + 0.1, dt).connect(body).connect(out);
    // The 4th partial gives the "wooden bar" colour and fades almost at once.
    const ov = this.ctx.createGain();
    this.env(ov.gain, s, gain * 0.22 * bright, 0.0015, dur * 0.16);
    this.osc("sine", f * 3.93, s, s + dur * 0.4 + 0.05, dt).connect(ov).connect(out);
    // Felt-mallet contact click.
    this.air({ at, gain: gain * 0.18 * bright, dur: 0.012, f: Math.min(5200, f * 4), q: 1.4, pan });
  }

  /** 2-op FM bell. Low index = glass, higher = brighter chime. */
  bell({ f, at, gain, dur = 0.9, ratio = 3.5, index = 1, pan, human = 3, attack = 0.003 }: VoiceOpts & { f: number; dur?: number; ratio?: number; index?: number; human?: number; attack?: number }) {
    const s = this.t0 + at;
    const out = this.sink(pan);
    const dt = this.cents(human);
    const amp = this.ctx.createGain();
    this.env(amp.gain, s, gain, attack, dur);
    const car = this.osc("sine", f, s, s + dur + 0.15, dt);
    const mod = this.osc("sine", f * ratio, s, s + dur + 0.15, dt);
    const depth = this.ctx.createGain();
    // Modulation depth decays much faster than the note: bright strike → pure tail.
    depth.gain.setValueAtTime(index * f * ratio, s);
    depth.gain.setTargetAtTime(index * f * ratio * 0.06, s, Math.max(0.01, dur * 0.12));
    mod.connect(depth).connect(car.frequency);
    car.connect(amp).connect(out);
  }

  /** Inharmonic, short-sustain metal — money only. */
  coin({ f, at, gain, dur = 0.5, pan }: VoiceOpts & { f: number; dur?: number }) {
    this.bell({ f, at, gain, dur, ratio: 2.76, index: 1.25, pan, human: 4, attack: 0.0015 });
    // A quiet high partial = the "ting" of a real coin, gone in a blink.
    this.bell({ f: f * 2.41, at, gain: gain * 0.22, dur: dur * 0.35, ratio: 1.5, index: 0.4, pan, human: 4, attack: 0.001 });
  }

  /** Soft sustained sine/triangle — warm floor under chords. */
  pad({ f, at, gain, dur = 1, attack = 0.04, type = "sine", pan }: VoiceOpts & { f: number; dur?: number; attack?: number; type?: OscillatorType }) {
    const s = this.t0 + at;
    const g = this.ctx.createGain();
    this.env(g.gain, s, gain, attack, dur);
    this.osc(type, f, s, s + dur + 0.2, this.cents(2)).connect(g).connect(this.sink(pan));
  }

  /** Band-passed noise; `to` sweeps the centre frequency (motion). */
  air({ at, gain, dur, f = 2000, to, q = 0.9, pan, attack = 0.002 }: VoiceOpts & { dur: number; f?: number; to?: number; q?: number; attack?: number }) {
    const s = this.t0 + at;
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer(this.ctx);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = q;
    bp.frequency.setValueAtTime(f, s);
    if (to) bp.frequency.exponentialRampToValueAtTime(to, s + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(gain, s + attack);
    g.gain.setTargetAtTime(0, s + attack, Math.max(0.004, (dur - attack) / 3.5));
    src.connect(bp).connect(g).connect(this.sink(pan));
    src.start(s, this.rand() * 0.5);
    src.stop(s + dur + 0.1);
  }
}
