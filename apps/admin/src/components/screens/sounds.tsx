"use client";

import { CATEGORY_LABEL, measure, renderOffline, SOUNDS, sound, toWav, type SoundCategory, type SoundName } from "@aionix/sound";
import { Bell, Coins, Hand, Play, ShoppingBag, Store, Truck, Volume1, Volume2, VolumeX } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Breadcrumb } from "@/components/shell";
import { Card, PageHeader, Switch, cn } from "@/components/ui";
import { useAdminSound } from "@/lib/sound";

const ICONS: Record<SoundCategory, typeof Bell> = {
  toques: Hand,
  compra: ShoppingBag,
  pedidos: Truck,
  recompensas: Coins,
  avisos: Bell,
  painel: Store,
};

/** Sample parameters so climbing/cascading sounds are heard at their best. */
const DEMO: Partial<Record<SoundName, { level?: number; count?: number }>> = { stepUp: { level: 3 }, stepDown: { level: 2 }, coinShower: { count: 60 } };

const CATEGORIES = Object.keys(CATEGORY_LABEL) as SoundCategory[];
const NAMES = Object.keys(SOUNDS) as SoundName[];

/** Live waveform of whatever the kit is playing. */
function Scope() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    let data: Uint8Array<ArrayBuffer> | null = null;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr) {
        c.width = w * dpr;
        c.height = h * dpr;
      }
      const g = c.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const an = sound.ready ? sound.getAnalyser() : null;
      if (an && (!data || data.length !== an.fftSize)) data = new Uint8Array(an.fftSize);
      if (an && data) an.getByteTimeDomainData(data);
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "rgba(46, 204, 138, 0.15)");
      grad.addColorStop(0.5, "rgba(46, 204, 138, 1)");
      grad.addColorStop(1, "rgba(46, 204, 138, 0.15)");
      g.strokeStyle = grad;
      g.lineWidth = 2;
      g.lineJoin = "round";
      g.beginPath();
      const pts = 160;
      for (let i = 0; i <= pts; i++) {
        const x = (i / pts) * w;
        const v = data ? (data[Math.floor((i / pts) * (data.length - 1))]! - 128) / 128 : 0;
        const y = h / 2 + v * h * 1.6 * Math.sin((i / pts) * Math.PI);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="h-24 w-full" aria-hidden />;
}

export function SoundsScreen() {
  const prefs = useAdminSound();
  const [playing, setPlaying] = useState<SoundName | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Hook for the offline sound lab (scripts/sound-lab.mjs): renders & measures the real bundle.
  useEffect(() => {
    const w = window as unknown as { __aionixSoundLab?: unknown };
    w.__aionixSoundLab = {
      names: NAMES,
      meta: Object.fromEntries(NAMES.map((n) => [n, { label: SOUNDS[n].label, priority: SOUNDS[n].priority, category: SOUNDS[n].category }])),
      async run(name: SoundName) {
        const buf = await renderOffline(name, DEMO[name] ?? {});
        const m = measure(buf);
        const bytes = toWav(buf, m.durationS);
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return { ...m, wav: btoa(bin) };
      },
    };
    return () => void delete w.__aionixSoundLab;
  }, []);

  const audition = async (name: SoundName) => {
    await sound.unlock();
    sound.play(name, DEMO[name] ?? {}, { preview: true });
    setPlaying(name);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPlaying(null), SOUNDS[name].priority >= 4 ? 1600 : 700);
  };

  const playCategory = async (cat: SoundCategory) => {
    const list = NAMES.filter((n) => SOUNDS[n].category === cat);
    for (const n of list) {
      await audition(n);
      await new Promise((r) => setTimeout(r, SOUNDS[n].priority >= 4 ? 1900 : 900));
    }
  };

  const VolIcon = !prefs.enabled || prefs.volume === 0 ? VolumeX : prefs.volume < 0.5 ? Volume1 : Volume2;

  return (
    <>
      <Breadcrumb items={[{ label: "Configurações", href: "/configuracoes" }, { label: "Sons" }]} />
      <PageHeader title="Sons da plataforma" description="Cada momento do app e do painel tem um som próprio — curto, macio e na mesma tonalidade." />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative overflow-hidden rounded-2xl bg-sidebar p-6 text-white">
          <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-brand-3/10 blur-3xl" />
          <p className="text-[12px] font-semibold tracking-[0.14em] text-brand-3 uppercase">Identidade sonora</p>
          <p className="mt-2 max-w-md font-display text-[22px] leading-snug font-bold">Madeira para o toque, papel para a sacola, sinos para as novidades — e metal só para dinheiro.</p>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/60">Tudo é sintetizado no próprio aparelho (sem arquivos para baixar) em Dó maior pentatônica, então dois sons nunca brigam entre si.</p>
          <div className="mt-4 rounded-xl bg-white/5 px-2">
            <Scope />
          </div>
        </div>

        <Card title="Neste computador">
          <div className="space-y-5">
            <Switch checked={prefs.enabled} onChange={prefs.setEnabled} label="Sons do painel" />
            <div className={cn("transition-opacity", !prefs.enabled && "pointer-events-none opacity-40")}>
              <label htmlFor="vol" className="mb-2 flex items-center justify-between text-[13px] font-semibold text-ink-2">
                <span className="flex items-center gap-2"><VolIcon className="size-4 text-brand" /> Volume</span>
                <span className="tabular text-muted">{Math.round(prefs.volume * 100)}%</span>
              </label>
              <input
                id="vol"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={prefs.volume}
                onChange={(e) => prefs.setVolume(Number(e.target.value))}
                onPointerUp={() => audition("select")}
                onKeyUp={() => audition("select")}
                className="w-full accent-[var(--color-brand)]"
              />
            </div>
            <div className={cn(!prefs.enabled && "pointer-events-none opacity-40")}>
              <Switch checked={prefs.reminder} onChange={prefs.setReminder} label="Lembrete a cada 2 min enquanto houver pedido aguardando confirmação" />
            </div>
            <p className="text-[12.5px] leading-relaxed text-muted">O alerta de novo pedido toca mesmo com o painel em outra aba. Com várias abas abertas, só uma toca. Os clientes controlam os sons do app em <b>Conta → Sons</b>.</p>
          </div>
        </Card>
      </div>

      <div className="mt-6 space-y-6">
        {CATEGORIES.map((cat) => {
          const Icon = ICONS[cat];
          const list = NAMES.filter((n) => SOUNDS[n].category === cat);
          return (
            <section key={cat}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-[16px] font-bold">
                  <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><Icon className="size-4" strokeWidth={2.3} /></span>
                  {CATEGORY_LABEL[cat]}
                </h2>
                <button type="button" onClick={() => playCategory(cat)} className="text-[12.5px] font-semibold text-brand hover:underline">Ouvir todos</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((n) => {
                  const def = SOUNDS[n];
                  const on = playing === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      data-sound={n}
                      onClick={() => audition(n)}
                      className={cn("group flex items-start gap-3 rounded-2xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md", on ? "border-brand ring-2 ring-brand/15" : "border-line")}
                    >
                      <span className={cn("relative grid size-10 shrink-0 place-items-center rounded-xl transition-colors", on ? "bg-brand text-white" : "bg-line-2 text-ink-2 group-hover:bg-brand-soft group-hover:text-brand")}>
                        {on ? (
                          <span className="flex h-4 items-end gap-[3px]">
                            {[0, 1, 2, 3].map((i) => (
                              <motion.span key={i} className="w-[3px] rounded-full bg-white" animate={{ height: ["30%", "100%", "45%", "85%", "30%"] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }} />
                            ))}
                          </span>
                        ) : (
                          <Play className="size-4 translate-x-px" fill="currentColor" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-bold">{def.label}</span>
                        <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{def.when}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
