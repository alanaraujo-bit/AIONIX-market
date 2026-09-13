import { quoteSchema, type Banner, type Category } from "@aionix/shared";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { db, schema } from "../db/client";
import { ACCENT_FROM, ACCENT_TO, foldAccents, notFound, pageParams, parse, str } from "../lib/http";
import { getActivePromotions, quoteCart, serializeProduct, type ActivePromotion } from "../lib/pricing";
import { getSettings } from "../lib/settings";

const p = schema.products;

function onSaleCondition(promos: ActivePromotion[]): SQL {
  const productIds = [...new Set(promos.flatMap((x) => [...x.productIds]))];
  const categoryIds = [...new Set(promos.flatMap((x) => [...x.categoryIds]))];
  const conds: SQL[] = [gt(p.compareAtCents, p.priceCents)];
  if (productIds.length) conds.push(inArray(p.id, productIds));
  if (categoryIds.length) conds.push(inArray(p.categoryId, categoryIds));
  return or(...conds)!;
}

/** Products carrying a members-only price below the list price. */
function clubCondition(): SQL {
  return and(isNotNull(p.clubPriceCents), lt(p.clubPriceCents, p.priceCents))!;
}

async function categorySlugMap() {
  const rows = await db.select({ id: schema.categories.id, slug: schema.categories.slug }).from(schema.categories);
  return new Map(rows.map((r) => [r.id, r.slug]));
}

async function listCategories(): Promise<Category[]> {
  const rows = await db
    .select({
      category: schema.categories,
      productCount: sql<number>`(select count(*)::int from ${p} where ${p.categoryId} = ${schema.categories.id} and ${p.active})`,
    })
    .from(schema.categories)
    .where(eq(schema.categories.active, true))
    .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name));
  return rows.map(({ category: c, productCount }) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    color: c.color,
    imageUrl: c.imageUrl,
    sortOrder: c.sortOrder,
    active: c.active,
    productCount,
  }));
}

async function activeBanners(): Promise<Banner[]> {
  const now = new Date();
  const rows = await db
    .select({ banner: schema.banners, categorySlug: schema.categories.slug })
    .from(schema.banners)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.banners.categoryId))
    .where(
      and(
        eq(schema.banners.active, true),
        or(isNull(schema.banners.startsAt), lte(schema.banners.startsAt, now)),
        or(isNull(schema.banners.endsAt), gte(schema.banners.endsAt, now)),
      ),
    )
    .orderBy(asc(schema.banners.sortOrder));
  return rows.map(({ banner: b, categorySlug }) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    ctaLabel: b.ctaLabel,
    imageUrl: b.imageUrl,
    theme: b.theme as Banner["theme"],
    promotionId: b.promotionId,
    categoryId: b.categoryId,
    categorySlug: categorySlug ?? null,
  }));
}

export const catalogRoutes: FastifyPluginAsync = async (app) => {
  app.get("/catalog/home", async (_req, reply) => {
    const [settings, categories, banners, promos, slugs] = await Promise.all([
      getSettings(),
      listCategories(),
      activeBanners(),
      getActivePromotions(),
      categorySlugMap(),
    ]);
    const baseWhere = and(eq(p.active, true), gt(p.stock, 0));
    const [featured, deals, best, club] = await Promise.all([
      db.select().from(p).where(and(baseWhere, eq(p.featured, true))).orderBy(desc(p.soldCount)).limit(12),
      db.select().from(p).where(and(baseWhere, onSaleCondition(promos))).orderBy(desc(p.soldCount)).limit(16),
      db.select().from(p).where(baseWhere).orderBy(desc(p.soldCount)).limit(12),
      db.select().from(p).where(and(baseWhere, clubCondition())).orderBy(desc(p.soldCount)).limit(12),
    ]);
    const ser = (rows: (typeof p.$inferSelect)[]) => rows.map((r) => serializeProduct(r, promos, slugs.get(r.categoryId)));
    const dealsSer = ser(deals).sort((a, b) => b.discountPercent - a.discountPercent);

    if (banners.length) {
      void db
        .update(schema.banners)
        .set({ impressions: sql`${schema.banners.impressions} + 1` })
        .where(inArray(schema.banners.id, banners.map((b) => b.id)))
        .catch(() => {});
    }
    reply.header("cache-control", "no-store");
    return {
      store: {
        name: settings.storeName,
        open: settings.storeOpen,
        etaMinutes: settings.etaMinutes,
        deliveryFeeCents: settings.deliveryFeeCents,
        freeDeliveryThresholdCents: settings.freeDeliveryThresholdCents,
        minimumOrderCents: settings.minimumOrderCents,
      },
      banners,
      categories,
      featured: ser(featured),
      deals: dealsSer,
      bestSellers: ser(best),
      club: ser(club).filter((x) => x.clubPriceCents !== null),
    };
  });

  app.get("/categories", async () => ({ items: await listCategories() }));

  app.get("/products", async (req) => {
    const q = req.query as Record<string, string | undefined>;
    const { page, pageSize, offset } = pageParams(q, 60);
    const promos = await getActivePromotions();
    const conds: SQL[] = [eq(p.active, true)];

    const categorySlug = str(q.category);
    if (categorySlug) {
      const [cat] = await db
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(eq(schema.categories.slug, categorySlug));
      if (!cat) return { items: [], total: 0, page, pageSize };
      conds.push(eq(p.categoryId, cat.id));
    }
    const term = str(q.q);
    if (term) {
      const pattern = `%${foldAccents(term).replace(/[%_]/g, "")}%`;
      const fold = (col: SQL | typeof p.name) => sql`translate(lower(${col}), ${ACCENT_FROM}, ${ACCENT_TO})`;
      conds.push(
        or(
          sql`${fold(p.name)} like ${pattern}`,
          sql`${fold(sql`coalesce(${p.brand}, '')`)} like ${pattern}`,
          sql`${fold(sql`array_to_string(${p.tags}, ' ')`)} like ${pattern}`,
        )!,
      );
    }
    if (q.onSale === "1" || q.onSale === "true") conds.push(onSaleCondition(promos));
    if (q.club === "1" || q.club === "true") conds.push(clubCondition());
    if (q.exclude) conds.push(ne(p.id, q.exclude));

    const order = (() => {
      switch (q.sort) {
        case "price_asc":
          return [asc(p.priceCents)];
        case "price_desc":
          return [desc(p.priceCents)];
        case "name":
          return [asc(p.name)];
        case "newest":
          return [desc(p.createdAt)];
        default:
          return [desc(sql`${p.stock} > 0`), desc(p.featured), desc(p.soldCount), asc(p.name)];
      }
    })();

    const where = and(...conds);
    const [rows, [{ total } = { total: 0 }], slugs] = await Promise.all([
      db.select().from(p).where(where).orderBy(...order).limit(pageSize).offset(offset),
      db.select({ total: sql<number>`count(*)::int` }).from(p).where(where),
      categorySlugMap(),
    ]);
    return {
      items: rows.map((r) => serializeProduct(r, promos, slugs.get(r.categoryId))),
      total,
      page,
      pageSize,
    };
  });

  app.get("/products/:slug", async (req) => {
    const { slug } = req.params as { slug: string };
    const [row] = await db
      .select()
      .from(p)
      .where(and(eq(p.slug, slug), eq(p.active, true)));
    if (!row) throw notFound("Produto não encontrado");
    const [promos, slugs, related] = await Promise.all([
      getActivePromotions(),
      categorySlugMap(),
      db
        .select()
        .from(p)
        .where(and(eq(p.categoryId, row.categoryId), eq(p.active, true), ne(p.id, row.id), gt(p.stock, 0)))
        .orderBy(desc(p.soldCount))
        .limit(10),
    ]);
    const [category] = await db.select().from(schema.categories).where(eq(schema.categories.id, row.categoryId));
    return {
      product: serializeProduct(row, promos, slugs.get(row.categoryId)),
      category: category ? { id: category.id, name: category.name, slug: category.slug } : null,
      related: related.map((r) => serializeProduct(r, promos, slugs.get(r.categoryId))),
    };
  });

  app.post("/banners/:id/click", async (req) => {
    const { id } = req.params as { id: string };
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false };
    await db
      .update(schema.banners)
      .set({ clicks: sql`${schema.banners.clicks} + 1` })
      .where(eq(schema.banners.id, id));
    return { ok: true };
  });

  app.post("/cart/quote", async (req) => {
    const { items } = parse(quoteSchema, req.body);
    return quoteCart(items, { userId: req.auth?.userId });
  });
};
