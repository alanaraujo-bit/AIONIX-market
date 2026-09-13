import { desc } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { db, schema } from "../db/client";
import { requireAdmin } from "../lib/auth";
import { badRequest, notFound } from "../lib/http";
import { storeImage } from "../lib/images";
import { getObject } from "../lib/storage";

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/heic", "image/heif"]);

export const mediaRoutes: FastifyPluginAsync = async (app) => {
  app.get("/media/*", async (req, reply) => {
    const key = (req.params as { "*": string })["*"];
    if (!key || key.includes("..")) throw notFound();
    const obj = await getObject(key);
    if (!obj) throw notFound();
    return reply
      .header("content-type", obj.mime)
      .header("cache-control", "public, max-age=31536000, immutable")
      .header("cross-origin-resource-policy", "cross-origin")
      .send(obj.body);
  });

  app.post("/admin/media", async (req, reply) => {
    requireAdmin(req);
    const file = await req.file();
    if (!file) throw badRequest("Envie um arquivo");
    if (!ACCEPTED.has(file.mimetype)) throw badRequest("Formato não suportado. Use JPG, PNG, WebP ou AVIF.");
    const buffer = await file.toBuffer();
    const image = await storeImage(buffer);
    return reply.status(201).send({ media: image });
  });

  app.get("/admin/media", async (req) => {
    requireAdmin(req);
    const rows = await db.select().from(schema.media).orderBy(desc(schema.media.createdAt)).limit(120);
    return { items: rows };
  });
};
