import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

export const sqlClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 15,
  onnotice: () => {},
});

export const db = drizzle(sqlClient, { schema, casing: "snake_case" });
export type DB = typeof db;
export { schema };
