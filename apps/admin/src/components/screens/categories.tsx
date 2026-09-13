"use client";

import { play } from "@/lib/sound";
import { categoryInputSchema, type CategoryInput } from "@aionix/shared";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Boxes, GripVertical, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAdminCategories, useAdminMutation, type AdminCategory } from "@/lib/queries";
import { Badge, Button, Card, ConfirmDialog, Drawer, EmptyState, Input, PageHeader, Skeleton, Switch, cn, fieldErrors } from "@/components/ui";

const SWATCHES = ["#dff1dc", "#f9dcd6", "#f6e7c9", "#fbf1cf", "#f6dfe4", "#ece5d5", "#e7d9cc", "#d9ebf5", "#efdcd1", "#dbeaf3", "#d8eef0", "#e5e0f2"];
const EMOJIS = ["🥬", "🥩", "🥖", "🧀", "🥓", "🍚", "☕", "🥤", "🍫", "🧊", "🧼", "🧴", "🍎", "🐟", "🍷", "🍼", "🐶", "🧁"];

function Row({ c, onEdit }: { c: AdminCategory; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex items-center gap-3 bg-card px-4 py-3", isDragging && "relative z-10 shadow-pop")}>
      <button type="button" aria-label="Reordenar" {...attributes} {...listeners} className="cursor-grab touch-none text-faint hover:text-ink active:cursor-grabbing"><GripVertical className="size-4" /></button>
      <span className="grid size-11 place-items-center rounded-xl text-[22px]" style={{ background: c.color }}>{c.icon}</span>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className="block text-[14px] font-semibold">{c.name}</span>
        <span className="block text-[12px] text-muted">/{c.slug} · {c.productCount} {c.productCount === 1 ? "produto" : "produtos"}</span>
      </button>
      {!c.active && <Badge>Oculta</Badge>}
      <Button size="sm" variant="ghost" onClick={onEdit}>Editar</Button>
    </li>
  );
}

function CategoryForm({ category, onClose }: { category: AdminCategory | null; onClose: () => void }) {
  const [form, setForm] = useState<CategoryInput>({ name: category?.name ?? "", icon: category?.icon ?? "🛒", color: category?.color ?? SWATCHES[0]!, imageUrl: category?.imageUrl ?? null, sortOrder: category?.sortOrder ?? 0, active: category?.active ?? true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const save = useAdminMutation(
    (input: CategoryInput) => (category ? api(`/admin/categories/${category.id}`, { method: "PUT", body: input }) : api("/admin/categories", { body: input })),
    { invalidate: [["admin", "categories"]], success: category ? "Categoria atualizada" : "Categoria criada", onSuccess: onClose },
  );
  const remove = useAdminMutation(() => api(`/admin/categories/${category!.id}`, { method: "DELETE" }), { sound: "remove", invalidate: [["admin", "categories"]], success: "Categoria excluída", onSuccess: onClose });
  const submit = () => {
    const parsed = categoryInputSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues.map((i) => ({ path: String(i.path[0]), message: i.message }))));
    save.mutate(parsed.data, { onError: (e) => e instanceof ApiError && e.details && setErrors(fieldErrors(e.details)) });
  };
  return (
    <Drawer open onClose={onClose} title={category ? "Editar categoria" : "Nova categoria"} width="max-w-md" footer={<>{category && <Button variant="danger" className="mr-auto" onClick={() => setConfirm(true)}><Trash2 className="size-4" /> Excluir</Button>}<Button variant="outline" onClick={onClose}>Cancelar</Button><Button loading={save.isPending} onClick={submit}>Salvar</Button></>}>
      <div className="mb-5 flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-line">
        <span className="grid size-16 place-items-center rounded-2xl text-[32px]" style={{ background: form.color }}>{form.icon}</span>
        <div>
          <p className="font-display text-[17px] font-bold">{form.name || "Prévia"}</p>
          <p className="text-[12.5px] text-muted">Assim aparece no app</p>
        </div>
      </div>
      <Input label="Nome" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} autoFocus />
      <span className="mt-4 mb-1.5 block text-[12.5px] font-semibold text-ink-2">Ícone</span>
      <div className="flex flex-wrap gap-1.5">
        {EMOJIS.map((e) => <button key={e} type="button" onClick={() => setForm((f) => ({ ...f, icon: e }))} className={cn("grid size-10 place-items-center rounded-lg text-[20px] ring-2", form.icon === e ? "bg-brand-soft ring-brand" : "bg-card ring-transparent hover:ring-line")}>{e}</button>)}
        <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value.slice(0, 4) }))} className="h-10 w-16 rounded-lg bg-card text-center text-[18px] ring-1 ring-line outline-none focus:ring-brand-3" aria-label="Emoji personalizado" />
      </div>
      <span className="mt-4 mb-1.5 block text-[12.5px] font-semibold text-ink-2">Cor de fundo</span>
      <div className="flex flex-wrap gap-2">
        {SWATCHES.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setForm((f) => ({ ...f, color: c }))} className={cn("size-8 rounded-full ring-2 ring-offset-2 ring-offset-canvas", form.color === c ? "ring-brand" : "ring-transparent")} style={{ background: c }} />)}
        <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="size-8 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="Cor personalizada" />
      </div>
      <div className="mt-5"><Switch checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label="Visível no app" /></div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Excluir categoria?" description={category?.productCount ? `Esta categoria tem ${category.productCount} produto(s). Mova-os antes de excluir.` : "Esta ação não pode ser desfeita."} confirmLabel="Excluir" loading={remove.isPending} onConfirm={() => remove.mutate(undefined)} />
    </Drawer>
  );
}

export function CategoriesScreen() {
  const { data, isPending } = useAdminCategories();
  const [order, setOrder] = useState<AdminCategory[]>([]);
  const [editing, setEditing] = useState<AdminCategory | null | "new">(null);
  useEffect(() => {
    if (data) setOrder(data);
  }, [data]);
  const reorder = useAdminMutation((ids: string[]) => api("/admin/categories/reorder", { body: { ids } }), { invalidate: [["admin", "categories"]] });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.findIndex((c) => c.id === active.id), order.findIndex((c) => c.id === over.id));
    setOrder(next);
    play("select");
    reorder.mutate(next.map((c) => c.id));
  };

  return (
    <>
      <PageHeader title="Categorias" description="Arraste para definir a ordem exibida no app" actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> Nova categoria</Button>} />
      <Card padded={false}>
        {isPending ? (
          <div className="space-y-2 p-5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : !order.length ? (
          <EmptyState icon={<Boxes className="size-6" />} title="Nenhuma categoria" action={<Button onClick={() => setEditing("new")}>Criar a primeira</Button>} />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={order.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-line-2">{order.map((c) => <Row key={c.id} c={c} onEdit={() => setEditing(c)} />)}</ul>
            </SortableContext>
          </DndContext>
        )}
      </Card>
      {editing && <CategoryForm key={editing === "new" ? "new" : editing.id} category={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
