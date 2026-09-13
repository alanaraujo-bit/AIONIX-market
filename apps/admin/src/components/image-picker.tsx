"use client";

import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { upload } from "@/lib/api";
import { useMedia, type MediaItem } from "@/lib/queries";
import { Button, cn } from "./ui";

/** Drop zone + library picker. Uploads are optimized server-side (WebP + blur). */
export function ImagePicker({ value, onChange, label = "Imagem", aspect = "square" }: { value: string | null; onChange: (url: string | null) => void; label?: string; aspect?: "square" | "wide" }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [library, setLibrary] = useState(false);
  const media = useMedia();

  const send = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Envie um arquivo de imagem");
    if (file.size > 12 * 1024 * 1024) return toast.error("Imagem acima de 12 MB");
    setBusy(true);
    try {
      const { media } = await upload<{ media: MediaItem }>("/admin/media", file);
      onChange(media.url);
      void qc.invalidateQueries({ queryKey: ["admin", "media"] });
      toast.success(`Imagem otimizada (${Math.round(media.sizeBytes / 1024)} KB)`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">{label}</span>
      <div
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) void send(f);
        }}
        className={cn("relative flex overflow-hidden rounded-xl bg-card ring-1 transition-shadow", drag ? "ring-2 ring-brand-3" : "ring-line", aspect === "square" ? "aspect-square max-w-[240px]" : "aspect-[21/9]")}
      >
        {value ? (
          <>
            <img src={value} alt="" className="size-full object-contain p-2 mix-blend-multiply" />
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-ink/60 p-2">
              <Button size="sm" variant="secondary" onClick={() => input.current?.click()}>Trocar</Button>
              <Button size="sm" variant="secondary" aria-label="Remover imagem" onClick={() => onChange(null)}><Trash2 className="size-3.5" /></Button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-muted hover:bg-line-2/50">
            {busy ? <Loader2 className="size-7 animate-spin text-brand" /> : <UploadCloud className="size-7" />}
            <span className="text-[12.5px] font-semibold">{busy ? "Otimizando…" : "Arraste ou clique para enviar"}</span>
            <span className="text-[11px]">JPG, PNG, WebP · até 12 MB</span>
          </button>
        )}
        {busy && value && <div className="absolute inset-0 grid place-items-center bg-white/70"><Loader2 className="size-7 animate-spin text-brand" /></div>}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && void send(e.target.files[0])} />
      <button type="button" onClick={() => setLibrary((v) => !v)} className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-2">
        <ImagePlus className="size-3.5" /> {library ? "Fechar biblioteca" : "Escolher da biblioteca"}
      </button>
      {library && (
        <div className="mt-2 grid max-h-56 grid-cols-5 gap-2 overflow-y-auto rounded-xl bg-line-2/60 p-2">
          {media.data?.map((m) => (
            <button key={m.id} type="button" onClick={() => (onChange(m.url), setLibrary(false))} className={cn("aspect-square overflow-hidden rounded-lg bg-card ring-2 hover:ring-brand-3", value === m.url ? "ring-brand" : "ring-transparent")}>
              <img src={m.url} alt="" loading="lazy" className="size-full object-contain p-1 mix-blend-multiply" />
            </button>
          ))}
          {!media.data?.length && <p className="col-span-5 p-4 text-center text-[12.5px] text-muted">Nenhuma imagem enviada ainda.</p>}
        </div>
      )}
    </div>
  );
}
