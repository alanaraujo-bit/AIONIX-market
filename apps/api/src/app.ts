import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { sql } from "drizzle-orm";
import Fastify, { type FastifyError } from "fastify";
import { db } from "./db/client";
import { isProd } from "./env";
import { resolveAuth } from "./lib/auth";
import { HttpError } from "./lib/http";
import { isAllowedOrigin } from "./lib/origins";
import { storageDriver } from "./lib/storage";
import { accountRoutes } from "./modules/account";
import { achievementRoutes } from "./modules/achievements";
import { adminCatalogRoutes } from "./modules/admin-catalog";
import { adminLoyaltyRoutes } from "./modules/admin-loyalty";
import { adminOpsRoutes } from "./modules/admin-ops";
import { authRoutes } from "./modules/auth";
import { catalogRoutes } from "./modules/catalog";
import { loyaltyRoutes } from "./modules/loyalty";
import { mediaRoutes } from "./modules/media";
import { realtimeRoutes } from "./modules/realtime";

export async function buildApp() {
  const app = Fastify({
    logger: { level: isProd ? "info" : "debug" },
    trustProxy: true,
    bodyLimit: 1_000_000,
  });

  app.decorateRequest("auth", null);

  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || isAllowedOrigin(origin)),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(multipart, { limits: { fileSize: 12 * 1024 * 1024, files: 1 } });

  app.setErrorHandler((err: FastifyError | HttpError, req, reply) => {
    if (err instanceof HttpError) {
      return reply
        .status(err.statusCode)
        .send({ error: { message: err.message, code: err.code, details: err.details } });
    }
    const status = err.statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    return reply.status(status).send({
      error: {
        message: status === 429 ? "Muitas tentativas. Aguarde um instante." : status >= 500 ? "Erro interno" : err.message,
        code: err.code ?? "ERROR",
      },
    });
  });

  app.addHook("onRequest", resolveAuth);

  const health = async () => {
    const started = performance.now();
    await db.execute(sql`select 1`);
    return {
      status: "ok",
      service: "aionix-api",
      db: "up",
      dbLatencyMs: Math.round((performance.now() - started) * 10) / 10,
      storage: storageDriver,
      time: new Date().toISOString(),
    };
  };
  app.get("/health", health);
  app.get("/api/health", health);

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(catalogRoutes, { prefix: "/api" });
  await app.register(accountRoutes, { prefix: "/api/me" });
  await app.register(achievementRoutes, { prefix: "/api" });
  await app.register(loyaltyRoutes, { prefix: "/api" });
  await app.register(realtimeRoutes, { prefix: "/api/realtime" });
  await app.register(mediaRoutes, { prefix: "/api" });
  await app.register(adminCatalogRoutes, { prefix: "/api/admin" });
  await app.register(adminOpsRoutes, { prefix: "/api/admin" });
  await app.register(adminLoyaltyRoutes, { prefix: "/api/admin/loyalty" });

  return app;
}
