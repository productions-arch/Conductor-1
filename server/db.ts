/**
 * Postgres connection (Neon).
 * Uses the @neondatabase/serverless driver — works on both Node and Edge.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../shared/schema";

const url = process.env.DATABASE_URL;

// Helpful error if missing — fail loudly at startup.
if (!url && process.env.NODE_ENV === "production") {
  // Don't throw during build; only at first query.
  console.warn("[db] DATABASE_URL is not set. Auth + persistence will fail.");
}

export const sql = url ? neon(url) : null;
export const db = sql ? drizzle(sql, { schema }) : (null as any);

export function assertDb() {
  if (!db) {
    throw new Error(
      "Database is not configured. Set DATABASE_URL in your environment.",
    );
  }
  return db as ReturnType<typeof drizzle<typeof schema>>;
}

export { schema };
