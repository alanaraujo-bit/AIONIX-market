import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { buildApp } from "./app";
import { db, sqlClient } from "./db/client";
import { env } from "./env";
import { ensureBootstrapData } from "./db/bootstrap";

const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const migrationsFolder = path.resolve(here, "../drizzle");
  await migrate(db, { migrationsFolder });
  await ensureBootstrapData();

  const app = await buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    await sqlClient.end({ timeout: 5 });
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
