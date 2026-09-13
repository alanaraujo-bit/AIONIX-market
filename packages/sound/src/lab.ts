/**
 * Objective checks for the kit, run on offline renders: nothing clips, no DC,
 * sensible length, and every sound sits in its loudness band (loudness =
 * loudest 50 ms RMS window, a cheap stand-in for short-term LUFS).
 */

export interface SoundMetrics {
  peakDb: number;
  loudnessDb: number;
  durationS: number;
  dcOffset: number;
  /** Share of energy above 5 kHz — high values read as "harsh". */
  brightness: number;
}

const db = (x: number) => (x <= 0 ? -120 : 20 * Math.log10(x));

export function measure(buffer: AudioBuffer): SoundMetrics {
  const sr = buffer.sampleRate;
  const chans = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const n = buffer.length;
  const mono = new Float32Array(n);
  let peak = 0, sum = 0, last = 0;
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (const c of chans) {
      const x = c[i]!;
      peak = Math.max(peak, Math.abs(x));
      m += x;
    }
    m /= chans.length;
    mono[i] = m;
    sum += m;
    if (Math.abs(m) > 0.001) last = i; // −60 dBFS tail
  }
  const win = Math.floor(sr * 0.05);
  let loud = 0, acc = 0;
  for (let i = 0; i < n; i++) {
    acc += mono[i]! * mono[i]!;
    if (i >= win) acc -= mono[i - win]! * mono[i - win]!;
    if (i >= win - 1) loud = Math.max(loud, Math.sqrt(Math.max(0, acc) / win));
  }
  // Brightness: energy of a first-difference (≈ +6 dB/oct tilt) above a crude 5 kHz one-pole high-pass.
  const a = Math.exp((-2 * Math.PI * 5000) / sr);
  let hp = 0, prev = 0, hi = 0, all = 0;
  for (let i = 0; i < n; i++) {
    const x = mono[i]!;
    hp = a * (hp + x - prev);
    prev = x;
    hi += hp * hp;
    all += x * x;
  }
  return {
    peakDb: db(peak),
    loudnessDb: db(loud),
    durationS: (last + 1) / sr,
    dcOffset: sum / n,
    brightness: all ? hi / all : 0,
  };
}

/** 16-bit PCM WAV, trimmed to the audible part (+80 ms). */
export function toWav(buffer: AudioBuffer, durationS?: number): Uint8Array {
  const sr = buffer.sampleRate;
  const ch = buffer.numberOfChannels;
  const frames = Math.min(buffer.length, Math.ceil(((durationS ?? buffer.length / sr) + 0.08) * sr));
  const bytes = new Uint8Array(44 + frames * ch * 2);
  const v = new DataView(bytes.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + frames * ch * 2, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, frames * ch * 2, true);
  const data = Array.from({ length: ch }, (_, i) => buffer.getChannelData(i));
  let o = 44;
  for (let i = 0; i < frames; i++) {
    // Short fade on the very last 10 ms so a trimmed file never ends in a click.
    const fade = Math.min(1, (frames - i) / (sr * 0.01));
    for (const d of data) {
      const x = Math.max(-1, Math.min(1, d[i]! * fade));
      v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
      o += 2;
    }
  }
  return bytes;
}
