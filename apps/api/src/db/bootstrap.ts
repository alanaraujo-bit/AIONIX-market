import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { env } from "../env";
import { hashPassword, verifyPassword } from "../lib/auth";
import { DEFAULT_SETTINGS } from "../lib/settings";
import { db, schema } from "./client";

/**
 * Idempotent boot-time data: the store admin account and default settings.
 * ADMIN_PASSWORD (when set) is the source of truth for the admin password.
 */
export async function ensureBootstrapData() {
  const email = env.ADMIN_EMAIL.toLowerCase();
  const [admin] = await db
    .select({ id: schema.users.id, passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.email, email));

  if (!admin) {
    const password = env.ADMIN_PASSWORD ?? randomBytes(12).toString("base64url");
    if (!env.ADMIN_PASSWORD) console.warn(`[bootstrap] ADMIN_PASSWORD not set; generated admin password: ${password}`);
    await db.insert(schema.users).values({
      name: "Gestor AIONIX",
      email,
      passwordHash: await hashPassword(password),
      role: "admin",
    });
  } else if (env.ADMIN_PASSWORD && !(await verifyPassword(admin.passwordHash, env.ADMIN_PASSWORD))) {
    await db.update(schema.users).set({ passwordHash: await hashPassword(env.ADMIN_PASSWORD) }).where(eq(schema.users.id, admin.id));
    console.info("[bootstrap] admin password synced from ADMIN_PASSWORD");
  }

  await db.insert(schema.settings).values({ key: "store", value: DEFAULT_SETTINGS }).onConflictDoNothing();
}
