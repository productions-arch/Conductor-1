/**
 * Legacy storage module.
 *
 * The original template used better-sqlite3 with a username/password storage
 * interface. Conductor moved to Postgres (Neon) via Drizzle, and the new
 * endpoints in `openrouter.ts`, `auth.ts`, and route handlers read/write the
 * `db` object from `./db.ts` directly.
 *
 * This file is intentionally a no-op to keep backward compatibility with any
 * import lingering in the codebase. If nothing imports it, it can be deleted.
 */

export {};
