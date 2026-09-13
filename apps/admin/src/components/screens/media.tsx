"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ImageIcon, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { upload } from "@/lib/api";
import { useMedia, type MediaItem } from "@/lib/queries";
import { Button, Card, EmptyState, PageHeader, Skeleton, cn } from "@/components/ui";

export function MediaScreen() {
  const qc = useQueryClient();
  const { data, isPending } = useMedia();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const send = async (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setProgress({ done: 0, total: list.length });
    let ok = 0;
    for (const f of list) {
      try {
        await upload<{ media: MediaItem }>("/admin/media", f);
        ok++;
      } catch (err) {
        toast.error(`${f.name}: ${(err as Error).message}`);
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setProgress(null);
    void qc.invalidateQueries({ queryKey: ["admin", "media"] });
    if (ok) toast.success(`${ok} imagem(ns) otimizada(s)`);
  };

  const copy = async (m: MediaItem) => {
    await navigator.clipboard.writeText(m.url);
    setCopied(m.id);
    setTimeout(() => setCopied(null), 1500);
  };

  const totalBytes = data?.reduce((s, m) => s + m.sizeBytes, 0) ?? 0;

  return (
    <>
      <PageHeader title="Mídia" description={data ? `${data.length} arquivos · ${(totalBytes / 1024 / 1024).toFixed(1)} MB otimizados` : "Biblioteca de imagens"} actions={<Button onClick={() => input.current?.click()}><UploadCloud className="size-4" /> Enviar imagens</Button>} />
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && void send(e.target.files)} />
      <div
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => (e.preventDefault(), setDrag(false), void send(e.dataTransfer.files))}
        className={cn("mb-4 rounded-2xl border-2 border-dashed p-6 text-center transition-colors", drag ? "border-brand-3 bg-brand-soft/50" : "border-line bg-card/50")}
      >
        {progress ? (
          <div className="mx-auto max-w-xs">
            <p className="text-[13.5px] font-semibold">Otimizando {progress.done}/{progress.total}…</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-2"><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
          </div>
        ) : (
          <p className="text-[13.5px] text-muted">Arraste várias imagens aqui. Cada uma é convertida para WebP, redimensionada e ganha um placeholder de blur automaticamente.</p>
        )}
      </div>
      {isPending ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}</div>
      ) : !data?.length ? (
        <Card><EmptyState icon={<ImageIcon className="size-6" />} title="Biblioteca vazia" description="Envie imagens para usar em produtos e banners." /></Card>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
          {data.map((m) => (
            <figure key={m.id} className="group relative overflow-hidden rounded-xl bg-card ring-1 ring-line">
              <img src={m.url} alt="" loading="lazy" className="aspect-square w-full object-contain p-2 mix-blend-multiply" />
              <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-ink/70 px-2 py-1.5 text-[10.5px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                <span>{m.width}×{m.height} · {Math.round(m.sizeBytes / 1024)} KB</span>
                <button type="button" aria-label="Copiar URL" onClick={() => copy(m)} className="grid size-6 place-items-center rounded-md bg-white/20 hover:bg-white/30">{copied === m.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </>
  );
}
