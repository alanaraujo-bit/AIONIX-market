import {
  bannerInputSchema,
  categoryInputSchema,
  productInputSchema,
  promotionInputSchema,
  settingsSchema,
  slugify,
} from "@aionix/shared";
import { and, asc, desc, eq, inArray, lte, ne, sql, type SQL } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/client";
import { requireAdmin } from "../lib/auth";
import { ACCENT_FROM, ACCENT_TO, badRequest, conflict, foldAccents, notFound, pageParams, parse, str } from "../lib/http";
import { getActivePromotions, invalidatePricing, serializeProduct } from "../lib/pricing";
import { getSettings, saveSettings } from "../lib/settings";

const p = schema.products;
const c = schema.categories;
const pr = schema.promotions;
const b = schema.banners;

async function uniqueSlug(table: typeof p | typeof c, base: string, excludeId?: string) {
  const root = base || "item";
  let slug = root;
  for (let i = 2; ; i++) {
    const conds: SQL[] = [eq(table.slug, slug)];
    if (excludeId) conds.push(ne(table.id, excludeId));
    const [hit] = await db.select({ id: table.id }).from(table).where(and(...conds)).limit(1);
    if (!hit) return slug;
    slug = `${root}-${i}`;
  }
}

async function mediaBlurFor(url: string | null | undefined) {
  if (!url) return null;
  const [m] = await db.select({ blur: schema.media.blurDataUrl }).from(schema.media).where(eq(schema.media.url, url)).limit(1);
  return m?.blur ?? null;
}

function promoStatus(row: typeof pr.$inferSelect, now = new Date()) {
  if (!row.active) return "paused" as const;
  if (row.startsAt > now) return "scheduled" as const;
  if (row.endsAt < now) return "ended" as const;
  return "live" as const;
}

export const adminCatalogRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (req) => {
    requireAdmin(req);
  });

  // ---- Products --------------------------------------------------------
  app.get("/products", async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const { page, pageSize, offset } = pageParams(q, 100);
    const conds: SQL[] = [];
    const term = str(q.q);
    if (term) {
      const pattern = `%${foldAccents(term).replace(/[%_]/g, "")}%`;
      conds.push(
        sql`(translate(lower(${p.name}), ${ACCENT_FROM}, ${ACCENT_TO}) like ${pattern} or lower(coalesce(${p.sku}, '')) like ${pattern} or translate(lower(coalesce(${p.brand}, '')), ${ACCENT_FROM}, ${ACCENT_TO}) like ${pattern})`,
      );
    }
    if (str(q.categoryId)) conds.push(eq(p.categoryId, q.categoryId!));
    if (q.status === "active") conds.push(eq(p.active, true));
    if (q.status === "inactive") conds.push(eq(p.active, false));
    if (q.status === "low_stock") conds.push(lte(p.stock, 10));
    if (q.status === "featured") conds.push(eq(p.featured, true));

    const dir = q.dir === "asc" ? asc : desc;
    const sortCol = { name: p.name, price: p.priceCents, stock: p.stock, sold: p.soldCount, updated: p.updatedAt }[
      q.sort ?? "updated"
    ] ?? p.updatedAt;

    const where = conds.length ? and(...conds) : undefined;
    const [rows, [{ total } = { total: 0 }], promos, cats] = await Promise.all([
      db
        .select()
        .from(p)
        .where(where)
        .orderBy(dir(sortCol), asc(p.id))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: sql<number>`count(*)::int` }).from(p).where(where),
      getActivePromotions(),
      db.select({ id: c.id, name: c.name, slug: c.slug }).from(c),
    ]);
    const catById = new Map(cats.map((x) => [x.id, x]));
    return {
      items: rows.map((r) => ({
        ...serializeProduct(r, promos, catById.get(r.categoryId)?.slug),
        categoryName: catById.get(r.categoryId)?.name ?? "—",
        soldCount: r.soldCount,
        updatedAt: r.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  });

  app.get("/products/:id", async (req) => {
    const { id } = req.params as { id: string };
    const [row] = await db.select().from(p).where(eq(p.id, id));
    if (!row) throw notFound("Produto não encontrado");
    return { product: { ...serializeProduct(row, await getActivePromotions()), soldCount: row.soldCount } };
  });

  app.post("/products", async (req, reply) => {
    const input = parse(productInputSchema, req.body);
    const slug = await uniqueSlug(p, slugify(input.name));
    const [row] = await db
      .insert(p)
      .values({
        ...input,
        slug,
        brand: input.brand || null,
        sku: input.sku || null,
        compareAtCents: input.compareAtCents ?? null,
        imageUrl: input.imageUrl ?? null,
        blurDataUrl: await mediaBlurFor(input.imageUrl),
      })
      .returning();
    return reply.status(201).send({ product: serializeProduct(row!, await getActivePromotions()) });
  });

  app.put("/products/:id", async (req) => {
    const { id } = req.params as { id: string };
    const input = parse(productInputSchema, req.body);
    const [current] = await db.select().from(p).where(eq(p.id, id));
    if (!current) throw notFound("Produto não encontrado");
    const slug = current.name === input.name ? current.slug : await uniqueSlug(p, slugify(input.name), id);
    const [row] = await db
      .update(p)
      .set({
        ...input,
        slug,
        brand: input.brand || null,
        sku: input.sku || null,
        compareAtCents: input.compareAtCents ?? null,
        imageUrl: input.imageUrl ?? null,
        blurDataUrl: input.imageUrl === current.imageUrl ? current.blurDataUrl : await mediaBlurFor(input.imageUrl),
      })
      .where(eq(p.id, id))
      .returning();
    return { product: serializeProduct(row!, await getActivePromotions()) };
  });

  app.patch("/products/:id", async (req) => {
    const { id } = req.params as { id: string };
    const patch = parse(
      z.object({
        stock: z.number().int().min(0).optional(),
        priceCents: z.number().int().min(1).optional(),
        active: z.boolean().optional(),
        featured: z.boolean().optional(),
      }),
      req.body,
    );
    if (!Object.keys(patch).length) throw badRequest("Nada para atualizar");
    const [row] = await db.update(p).set(patch).where(eq(p.id, id)).returning();
    if (!row) throw notFound("Produto não encontrado");
    return { product: serializeProduct(row, await getActivePromotions()) };
  });

  app.post("/products/bulk", async (req) => {
    const input = parse(
      z.object({
        ids: z.array(z.string().uuid()).min(1).max(500),
        action: z.enum(["activate", "deactivate", "feature", "unfeature", "delete"]),
      }),
      req.body,
    );
    if (input.action === "delete") {
      await db.delete(p).where(inArray(p.id, input.ids));
    } else {
      const set =
        input.action === "activate"
          ? { active: true }
          : input.action === "deactivate"
            ? { active: false }
            : { featured: input.action === "feature" };
      await db.update(p).set(set).where(inArray(p.id, input.ids));
    }
    invalidatePricing();
    return { ok: true, affected: input.ids.length };
  });

  app.delete("/products/:id", async (req) => {
    const { id } = req.params as { id: string };
    const [row] = await db.delete(p).where(eq(p.id, id)).returning({ id: p.id });
    if (!row) throw notFound("Produto não encontrado");
    invalidatePricing();
    return { ok: true };
  });

  // ---- Categories ------------------------------------------------------
  app.get("/categories", async () => {
    const rows = await db
      .select({
        category: c,
        productCount: sql<number>`(select count(*)::int from ${p} where ${p.categoryId} = ${c.id})`,
      })
      .from(c)
      .orderBy(asc(c.sortOrder), asc(c.name));
    return { items: rows.map((r) => ({ ...r.category, productCount: r.productCount })) };
  });

  app.post("/categories", async (req, reply) => {
    const input = parse(categoryInputSchema, req.body);
    const slug = await uniqueSlug(c, slugify(input.name));
    const [row] = await db
      .insert(c)
      .values({ ...input, slug, imageUrl: input.imageUrl ?? null })
      .returning();
    return reply.status(201).send({ category: row });
  });

  app.put("/categories/:id", async (req) => {
    const { id } = req.params as { id: string };
    const input = parse(categoryInputSchema, req.body);
    const [row] = await db
      .update(c)
      .set({ ...input, imageUrl: input.imageUrl ?? null })
      .where(eq(c.id, id))
      .returning();
    if (!row) throw notFound("Categoria não encontrada");
    return { category: row };
  });

  app.post("/categories/reorder", async (req) => {
    const { ids } = parse(z.object({ ids: z.array(z.string().uuid()).min(1) }), req.body);
    await db.transaction(async (tx) => {
      for (const [i, id] of ids.entries()) await tx.update(c).set({ sortOrder: i }).where(eq(c.id, id));
    });
    return { ok: true };
  });

  app.delete("/categories/:id", async (req) => {
    const { id } = req.params as { id: string };
    const [{ n } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(p)
      .where(eq(p.categoryId, id));
    if (n > 0) throw conflict(`Esta categoria possui ${n} produto(s). Mova-os antes de excluir.`, "CATEGORY_IN_USE");
    const [row] = await db.delete(c).where(eq(c.id, id)).returning({ id: c.id });
    if (!row) throw notFound("Categoria não encontrada");
    return { ok: true };
  });

  // ---- Promotions ------------------------------------------------------
  const promotionStats = async (ids: string[]) => {
    if (!ids.length) return new Map<string, { orders: number; units: number; revenueCents: number; discountCents: number }>();
    const rows = await db
      .select({
        promotionId: schema.orderItems.promotionId,
        orders: sql<number>`count(distinct ${schema.orderItems.orderId})::int`,
        units: sql<number>`coalesce(sum(${schema.orderItems.quantity}), 0)::int`,
        revenueCents: sql<number>`coalesce(sum(${schema.orderItems.totalCents}), 0)::int`,
        discountCents: sql<number>`coalesce(sum((${schema.orderItems.originalUnitPriceCents} - ${schema.orderItems.unitPriceCents}) * ${schema.orderItems.quantity}), 0)::int`,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .where(and(inArray(schema.orderItems.promotionId, ids), ne(schema.orders.status, "cancelled")))
      .groupBy(schema.orderItems.promotionId);
    return new Map(rows.map((r) => [r.promotionId!, r]));
  };

  const loadPromotionLinks = async (ids: string[]) => {
    if (!ids.length) return { prods: [], cats: [] };
    const [prods, cats] = await Promise.all([
      db.select().from(schema.promotionProducts).where(inArray(schema.promotionProducts.promotionId, ids)),
      db.select().from(schema.promotionCategories).where(inArray(schema.promotionCategories.promotionId, ids)),
    ]);
    return { prods, cats };
  };

  app.get("/promotions", async () => {
    const rows = await db.select().from(pr).orderBy(desc(pr.createdAt));
    const ids = rows.map((r) => r.id);
    const [stats, links] = await Promise.all([promotionStats(ids), loadPromotionLinks(ids)]);
    return {
      items: rows.map((r) => ({
        ...r,
        status: promoStatus(r),
        productIds: links.prods.filter((l) => l.promotionId === r.id).map((l) => l.productId),
        categoryIds: links.cats.filter((l) => l.promotionId === r.id).map((l) => l.categoryId),
        stats: stats.get(r.id) ?? { orders: 0, units: 0, revenueCents: 0, discountCents: 0 },
      })),
    };
  });

  const savePromotion = async (body: unknown, id?: string) => {
    const input = parse(promotionInputSchema, body);
    if (!input.productIds.length && !input.categoryIds.length) {
      throw badRequest("Selecione ao menos um produto ou categoria para a campanha");
    }
    const { productIds, categoryIds, ...values } = input;
    const row = await db.transaction(async (tx) => {
      const [saved] = id
        ? await tx.update(pr).set(values).where(eq(pr.id, id)).returning()
        : await tx.insert(pr).values(values).returning();
      if (!saved) throw notFound("Campanha não encontrada");
      await tx.delete(schema.promotionProducts).where(eq(schema.promotionProducts.promotionId, saved.id));
      await tx.delete(schema.promotionCategories).where(eq(schema.promotionCategories.promotionId, saved.id));
      if (productIds.length) {
        await tx.insert(schema.promotionProducts).values(productIds.map((productId) => ({ promotionId: saved.id, productId })));
      }
      if (categoryIds.length) {
        await tx
          .insert(schema.promotionCategories)
          .values(categoryIds.map((categoryId) => ({ promotionId: saved.id, categoryId })));
      }
      return saved;
    });
    invalidatePricing();
    return { ...row, status: promoStatus(row), productIds, categoryIds };
  };

  app.post("/promotions", async (req, reply) => reply.status(201).send({ promotion: await savePromotion(req.body) }));
  app.put("/promotions/:id", async (req) => ({
    promotion: await savePromotion(req.body, (req.params as { id: string }).id),
  }));

  app.patch("/promotions/:id", async (req) => {
    const { id } = req.params as { id: string };
    const { active } = parse(z.object({ active: z.boolean() }), req.body);
    const [row] = await db.update(pr).set({ active }).where(eq(pr.id, id)).returning();
    if (!row) throw notFound("Campanha não encontrada");
    invalidatePricing();
    return { promotion: { ...row, status: promoStatus(row) } };
  });

  app.delete("/promotions/:id", async (req) => {
    const { id } = req.params as { id: string };
    const [row] = await db.delete(pr).where(eq(pr.id, id)).returning({ id: pr.id });
    if (!row) throw notFound("Campanha não encontrada");
    invalidatePricing();
    return { ok: true };
  });

  // ---- Banners ---------------------------------------------------------
  app.get("/banners", async () => {
    const rows = await db.select().from(b).orderBy(asc(b.sortOrder), desc(b.createdAt));
    return {
      items: rows.map((r) => ({ ...r, ctr: r.impressions ? Math.round((r.clicks / r.impressions) * 1000) / 10 : 0 })),
    };
  });

  const bannerValues = (input: z.output<typeof bannerInputSchema>) => ({
    ...input,
    imageUrl: input.imageUrl ?? null,
    promotionId: input.promotionId ?? null,
    categoryId: input.categoryId ?? null,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
  });

  app.post("/banners", async (req, reply) => {
    const input = parse(bannerInputSchema, req.body);
    const [row] = await db.insert(b).values(bannerValues(input)).returning();
    return reply.status(201).send({ banner: row });
  });

  app.put("/banners/:id", async (req) => {
    const { id } = req.params as { id: string };
    const input = parse(bannerInputSchema, req.body);
    const [row] = await db.update(b).set(bannerValues(input)).where(eq(b.id, id)).returning();
    if (!row) throw notFound("Banner não encontrado");
    return { banner: row };
  });

  app.patch("/banners/:id", async (req) => {
    const { id } = req.params as { id: string };
    const { active } = parse(z.object({ active: z.boolean() }), req.body);
    const [row] = await db.update(b).set({ active }).where(eq(b.id, id)).returning();
    if (!row) throw notFound("Banner não encontrado");
    return { banner: row };
  });

  app.delete("/banners/:id", async (req) => {
    const { id } = req.params as { id: string };
    const [row] = await db.delete(b).where(eq(b.id, id)).returning({ id: b.id });
    if (!row) throw notFound("Banner não encontrado");
    return { ok: true };
  });

  // ---- Customers -------------------------------------------------------
  app.get("/customers", async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const { page, pageSize, offset } = pageParams(q, 100);
    const u = schema.users;
    const o = schema.orders;
    const conds: SQL[] = [eq(u.role, "customer")];
    const term = str(q.q);
    if (term) {
      const pattern = `%${foldAccents(term)}%`;
      conds.push(
        sql`(translate(lower(${u.name}), ${ACCENT_FROM}, ${ACCENT_TO}) like ${pattern} or lower(${u.email}) like ${pattern})`,
      );
    }
    const where = and(...conds);
    const [rows, [{ total } = { total: 0 }]] = await Promise.all([
      db
        .select({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          createdAt: u.createdAt,
          orders: sql<number>`(select count(*)::int from ${o} where ${o.userId} = ${u.id})`,
          spentCents: sql<number>`(select coalesce(sum(${o.totalCents}), 0)::int from ${o} where ${o.userId} = ${u.id} and ${o.status} <> 'cancelled')`,
          lastOrderAt: sql<string | null>`(select max(${o.createdAt}) from ${o} where ${o.userId} = ${u.id})`,
        })
        .from(u)
        .where(where)
        .orderBy(desc(u.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ total: sql<number>`count(*)::int` }).from(u).where(where),
    ]);
    return { items: rows, total, page, pageSize };
  });

  // ---- Settings --------------------------------------------------------
  app.get("/settings", async () => ({ settings: await getSettings() }));
  app.put("/settings", async (req) => ({ settings: await saveSettings(parse(settingsSchema, req.body)) }));
};
