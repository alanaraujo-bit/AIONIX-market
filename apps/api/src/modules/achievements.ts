import { achievementInputSchema } from "@aionix/shared";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/client";
import { achievements, achievementAwards } from "../db/achievement-schema";
import { requireAdmin, requireUser } from "../lib/auth";
import { acknowledgeAchievements, ensureAchievementDefaults, getMyAchievements, serializeAchievement } from "../lib/achievements";
import { badRequest, conflict, notFound, parse } from "../lib/http";
import { subscribe } from "../lib/events";

const uuid = z.string().uuid();
async function validateFilterReferences(rule: { productId?: string; categoryId?: string }) {
  if (rule.productId && !(await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.id, rule.productId)))[0]) throw badRequest("O produto escolhido não existe.");
  if (rule.categoryId && !(await db.select({ id: schema.categories.id }).from(schema.categories).where(eq(schema.categories.id, rule.categoryId)))[0]) throw badRequest("A categoria escolhida não existe.");
}
function rethrowWriteError(error: unknown): never {
  const candidate = error as { code?: string; cause?: { code?: string } };
  if (candidate.code === "23505" || candidate.cause?.code === "23505") throw conflict("Já existe uma conquista com esse identificador.");
  throw error;
}
export async function achievementRoutes(app: FastifyInstance) {
  app.get("/me/achievements", async req => getMyAchievements(requireUser(req).userId));
  app.post("/me/achievements/acknowledge", async req => { const auth = requireUser(req); const { ids } = parse(z.object({ ids: z.array(uuid).max(100) }), req.body); await acknowledgeAchievements(auth.userId, ids); return { ok: true }; });
  app.get("/admin/achievements", async req => {
    requireAdmin(req);
    await ensureAchievementDefaults();
    const rows = await db.select().from(achievements).orderBy(achievements.sortOrder);
    const counts = await db.select({ id: achievementAwards.achievementId, count: sql<number>`count(*)::int` }).from(achievementAwards).groupBy(achievementAwards.achievementId);
    const [stats] = await db.select({ awards: sql<number>`count(*)::int`, participants: sql<number>`count(distinct ${achievementAwards.userId})::int`, bonusCoins: sql<number>`coalesce(sum((${achievementAwards.snapshot}->>'bonusCoins')::int), 0)::float8` }).from(achievementAwards);
    return { achievements: rows.map(row => ({ ...serializeAchievement(row), recipientsCount: counts.find(count => count.id === row.id)?.count ?? 0 })), stats: { total: rows.length, active: rows.filter(row => row.active).length, ...stats } };
  });
  app.post("/admin/achievements", async (req, reply) => {
    requireAdmin(req); const definition = parse(achievementInputSchema, req.body);
    await ensureAchievementDefaults();
    await validateFilterReferences(definition.rule);
    const [row] = await db.insert(achievements).values({ slug: definition.slug, definition, active: definition.active, sortOrder: definition.sortOrder }).onConflictDoNothing().returning();
    if (!row) throw conflict("Já existe uma conquista com esse identificador.");
    return reply.code(201).send(serializeAchievement(row));
  });
  app.put("/admin/achievements/:id", async req => {
    requireAdmin(req); const { id } = parse(z.object({ id: uuid }), req.params); const definition = parse(achievementInputSchema, req.body);
    await validateFilterReferences(definition.rule);
    const [duplicate] = await db.select({ id: achievements.id }).from(achievements).where(eq(achievements.slug, definition.slug));
    if (duplicate && duplicate.id !== id) throw conflict("Já existe uma conquista com esse identificador.");
    const [row] = await db.update(achievements).set({ slug: definition.slug, definition, active: definition.active, sortOrder: definition.sortOrder, updatedAt: new Date() }).where(eq(achievements.id, id)).returning().catch(rethrowWriteError);
    if (!row) throw notFound("Conquista não encontrada."); return serializeAchievement(row);
  });
  app.post("/admin/achievements/:id/archive", async req => {
    requireAdmin(req); const { id } = parse(z.object({ id: uuid }), req.params);
    const [row] = await db.update(achievements).set({ active: false, updatedAt: new Date() }).where(eq(achievements.id, id)).returning();
    if (!row) throw notFound("Conquista não encontrada."); return serializeAchievement(row);
  });
  app.get("/admin/achievements/:id/recipients", async req => {
    requireAdmin(req); const { id } = parse(z.object({ id: uuid }), req.params);
    const { page, pageSize, search } = parse(z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(120).default("") }), req.query);
    const [definition] = await db.select({ id: achievements.id }).from(achievements).where(eq(achievements.id, id));
    if (!definition) throw notFound("Conquista não encontrada.");
    const escaped = search.replace(/[\\%_]/g, "\\$&");
    const where = and(eq(achievementAwards.achievementId, id), search ? or(ilike(schema.users.name, `%${escaped}%`), ilike(schema.users.email, `%${escaped}%`)) : undefined);
    const items = await db.select({ id: achievementAwards.id, userId: schema.users.id, name: schema.users.name, email: schema.users.email, awardedAt: achievementAwards.awardedAt, snapshot: achievementAwards.snapshot }).from(achievementAwards).innerJoin(schema.users, eq(schema.users.id, achievementAwards.userId)).where(where).orderBy(desc(achievementAwards.awardedAt), achievementAwards.id).limit(pageSize).offset((page - 1) * pageSize);
    const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(achievementAwards).innerJoin(schema.users, eq(schema.users.id, achievementAwards.userId)).where(where);
    return { items, total: count?.total ?? 0, page, pageSize };
  });
  // Events are emitted after order transactions commit. A page read also repairs missed events.
  const unsubscribe = subscribe(event => {
    if (event.type === "order.updated" && event.status === "delivered") void getMyAchievements(event.userId).catch(error => app.log.error({ err: error }, "Achievement reconciliation failed"));
  });
  app.addHook("onClose", async () => { unsubscribe(); });
}
