import { env } from "../env";

const allowedOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
// Vercel preview deployments of both frontends.
const previewOrigin = /^https:\/\/aionix-market(-admin)?(-[a-z0-9-]+)?\.vercel\.app$/;

export function isAllowedOrigin(origin: string | undefined) {
  return !!origin && (allowedOrigins.includes(origin) || previewOrigin.test(origin));
}
