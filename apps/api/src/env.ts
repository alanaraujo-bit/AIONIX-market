import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32).default("dev-only-secret-change-me-dev-only-secret"),
  /** Comma-separated list of allowed browser origins (direct calls / SSE). */
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001"),
  PUBLIC_API_URL: z.string().default("http://localhost:8080"),
  ADMIN_EMAIL: z.string().email().default("admin@aionix.market"),
  /** When set, the admin account password is kept in sync with this value at boot. */
  ADMIN_PASSWORD: z.string().min(8).optional(),
  // Optional S3-compatible bucket (Railway Buckets). Falls back to Postgres storage.
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
