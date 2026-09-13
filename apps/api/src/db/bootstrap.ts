import { eq } from "drizzle-orm";
import { env } from "../env";
import { hashPassword } from "../lib/auth";
import { DEFAULT_SETTINGS } from "../lib/settings";
import { db, schema } from "./client";

/** Idempotent boot-time data: the store admin account and default settings. */
export async function ensureBootstrapData() {
  const email = env.ADMIN_EMAIL.toLowerCase();
  const [admin] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
  if (!admin) {
    await db.insert(schema.users).values({
      name: "Gestor AIONIX",
      email,
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      role: "admin",
    });
  }
  await db.insert(schema.settings).values({ key: "store", value: DEFAULT_SETTINGS }).onConflictDoNothing();
}
