"use client";

import type { Address } from "@aionix/shared";
import { Home, MapPin, MoreHorizontal, Plus, Star } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AddressForm } from "@/components/address-form";
import { Badge, Button, EmptyState, Pressable, Skeleton } from "@/components/ui/primitives";
import { Screen, TopBar } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { useAddressMutations, useAddresses } from "@/lib/account";
import { useSession } from "@/lib/session";
import { haptic, toast } from "@/lib/toast";

export function AddressesScreen() {
  const router = useRouter();
  const { user, loading } = useSession();
  const addresses = useAddresses(!!user);
  const { remove, setDefault } = useAddressMutations();
  const [editing, setEditing] = useState<Address | null | "new">(null);
  const [menu, setMenu] = useState<Address | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/entrar?next=/conta/enderecos");
  }, [loading, user, router]);

  const list = addresses.data ?? [];

  return (
    <Screen
      header={<TopBar back backFallback="/conta" title="Endereços" subtitle={list.length ? `${list.length} de 10` : undefined} />}
      footer={
        <div className="pb-safe relative z-20 shrink-0 border-t border-line bg-card/95 px-4 pt-3 pb-3 backdrop-blur-xl">
          <Button size="lg" block onClick={() => setEditing("new")} disabled={list.length >= 10}>
            <Plus className="size-5" strokeWidth={2.6} /> Novo endereço
          </Button>
        </div>
      }
    >
      <div className="px-4 pt-2 pb-8">
        {addresses.isPending || loading ? (
          <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-[22px]" />)}</div>
        ) : list.length === 0 ? (
          <EmptyState icon={<MapPin className="size-9" strokeWidth={1.8} />} title="Nenhum endereço salvo" description="Cadastre onde você quer receber suas compras." />
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {list.map((a) => (
                <motion.li key={a.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} className="flex items-start gap-3 rounded-[22px] bg-card p-4 shadow-card">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                    <Home className="size-5" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[14.5px] font-bold">{a.label}</p>
                      {a.isDefault && <Badge tone="brand"><Star className="size-3 fill-current" /> Principal</Badge>}
                    </div>
                    <p className="mt-0.5 text-[13.5px] leading-snug text-ink-2">{a.street}, {a.number}{a.complement ? ` · ${a.complement}` : ""}</p>
                    <p className="text-[13px] text-muted">{a.district} · {a.city}/{a.state} · {a.zip}</p>
                    <p className="mt-1 text-[12.5px] text-muted">Recebe: {a.recipient}</p>
                  </div>
                  <Pressable aria-label="Opções" onClick={() => setMenu(a)} className="grid size-9 shrink-0 place-items-center rounded-full text-muted active:bg-line-2">
                    <MoreHorizontal className="size-5" />
                  </Pressable>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.label}>
        <div className="space-y-2 pb-2">
          {!menu?.isDefault && (
            <Button variant="secondary" block size="lg" loading={setDefault.isPending} onClick={() => menu && setDefault.mutate(menu.id, { onSuccess: () => (haptic(), setMenu(null), toast.success("Endereço principal atualizado")) })}>
              <Star className="size-4" /> Tornar principal
            </Button>
          )}
          <Button variant="secondary" block size="lg" onClick={() => (setEditing(menu), setMenu(null))}>Editar</Button>
          <Button variant="danger" block size="lg" loading={remove.isPending} onClick={() => menu && remove.mutate(menu.id, { onSuccess: () => (haptic([10, 30, 10]), setMenu(null), toast("Endereço removido", { sound: "remove" })), onError: (e) => toast.error(e.message) })}>
            Excluir
          </Button>
        </div>
      </Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Novo endereço" : "Editar endereço"}>
        <AddressForm address={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      </Sheet>
    </Screen>
  );
}
