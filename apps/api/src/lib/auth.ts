import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { SignJWT, jwtVerify } from "jose";
import { db, schema } from "../db/client";
import { env, isProd } from "../env";
import { forbidden, unauthorized } from "./http";

export type Role = "customer" | "admin";
export interface AuthContext {
  userId: string;
  role: Role;
}

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ACCESS_COOKIE = "ax_at";
const REFRESH_COOKIE = "ax_rt";
const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const cookieBase = { httpOnly: true, secure: isProd, sameSite: "lax" as const, path: "/api" };

export const hashPassword = (pw: string) => hash(pw, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
export const verifyPassword = (hashStr: string, pw: string) => verify(hashStr, pw).catch(() => false);

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function signAccess(ctx: AuthContext) {
  return new SignJWT({ role: ctx.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(ctx.userId)
    .setAudience("access")
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_S}s`)
    .sign(secret);
}

/** Short-lived token used to open a direct SSE connection to the API. */
export async function signTicket(ctx: AuthContext) {
  return new SignJWT({ role: ctx.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(ctx.userId)
    .setAudience("sse")
    .setIssuedAt()
    .setExpirationTime("90s")
    .sign(secret);
}

export async function verifyToken(token: string, audience: "access" | "sse"): Promise<AuthContext | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { audience });
    if (!payload.sub) return null;
    return { userId: payload.sub, role: payload.role === "admin" ? "admin" : "customer" };
  } catch {
    return null;
  }
}

function setAccessCookie(reply: FastifyReply, token: string) {
  reply.setCookie(ACCESS_COOKIE, token, { ...cookieBase, maxAge: ACCESS_TTL_S });
}

export async function startSession(req: FastifyRequest, reply: FastifyReply, ctx: AuthContext) {
  const refresh = randomBytes(32).toString("base64url");
  await db.insert(schema.sessions).values({
    userId: ctx.userId,
    tokenHash: sha256(refresh),
    userAgent: req.headers["user-agent"]?.slice(0, 250) ?? null,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  reply.setCookie(REFRESH_COOKIE, refresh, { ...cookieBase, maxAge: REFRESH_TTL_MS / 1000 });
  setAccessCookie(reply, await signAccess(ctx));
  req.auth = ctx;
}

export async function endSession(req: FastifyRequest, reply: FastifyReply) {
  const refresh = req.cookies[REFRESH_COOKIE];
  if (refresh) {
    await db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.sessions.tokenHash, sha256(refresh)));
  }
  reply.clearCookie(ACCESS_COOKIE, cookieBase);
  reply.clearCookie(REFRESH_COOKIE, cookieBase);
  req.auth = null;
}

/**
 * onRequest hook: resolves the caller from the access cookie, transparently
 * minting a fresh access token from a valid refresh session when it expired.
 */
export async function resolveAuth(req: FastifyRequest, reply: FastifyReply) {
  req.auth = null;
  if (!req.url.startsWith("/api/")) return;

  const access = req.cookies[ACCESS_COOKIE];
  if (access) {
    const ctx = await verifyToken(access, "access");
    if (ctx) {
      req.auth = ctx;
      return;
    }
  }

  const refresh = req.cookies[REFRESH_COOKIE];
  if (!refresh) return;
  const [row] = await db
    .select({ userId: schema.users.id, role: schema.users.role })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.tokenHash, sha256(refresh)),
        isNull(schema.sessions.revokedAt),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) {
    reply.clearCookie(REFRESH_COOKIE, cookieBase);
    return;
  }
  const ctx: AuthContext = { userId: row.userId, role: row.role };
  setAccessCookie(reply, await signAccess(ctx));
  req.auth = ctx;
}

export function requireUser(req: FastifyRequest): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

export function requireAdmin(req: FastifyRequest): AuthContext {
  const ctx = requireUser(req);
  if (ctx.role !== "admin") throw forbidden();
  return ctx;
}
