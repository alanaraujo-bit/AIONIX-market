import { loginSchema, registerSchema } from "@aionix/shared";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db, schema } from "../db/client";
import { endSession, hashPassword, startSession, verifyPassword } from "../lib/auth";
import { conflict, forbidden, HttpError, parse } from "../lib/http";
import { serializeUser } from "../lib/serializers";

const authLimit = { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } };

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", authLimit, async (req, reply) => {
    const input = parse(registerSchema, req.body);
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, input.email));
    if (existing) throw conflict("Este e-mail já possui cadastro", "EMAIL_TAKEN");
    const [user] = await db
      .insert(schema.users)
      .values({
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        passwordHash: await hashPassword(input.password),
        // Registering through the app is what makes someone a club member.
        clubMember: true,
        clubJoinedAt: new Date(),
      })
      .returning();
    await startSession(req, reply, { userId: user!.id, role: user!.role });
    return reply.status(201).send({ user: serializeUser(user!) });
  });

  app.post("/login", authLimit, async (req, reply) => {
    const input = parse(loginSchema.extend({ scope: z.enum(["customer", "admin"]).optional() }), req.body);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, input.email));
    const ok = user ? await verifyPassword(user.passwordHash, input.password) : false;
    if (!user || !ok) throw new HttpError(401, "E-mail ou senha incorretos", "INVALID_CREDENTIALS");
    if (input.scope === "admin" && user.role !== "admin") throw forbidden("Esta conta não tem acesso ao painel");
    await startSession(req, reply, { userId: user.id, role: user.role });
    return { user: serializeUser(user) };
  });

  app.post("/logout", async (req, reply) => {
    await endSession(req, reply);
    return { ok: true };
  });

  app.get("/session", async (req) => {
    if (!req.auth) return { user: null };
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.auth.userId));
    return { user: user ? serializeUser(user) : null };
  });
};
