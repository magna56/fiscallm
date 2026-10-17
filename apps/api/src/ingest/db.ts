import { schema } from "@fiscallm/shared";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { createDb } from "@fiscallm/shared/db";

// Any Postgres driver: postgres-js in production, PGlite in tests.
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: AnyDb | undefined;

export function getDb(): AnyDb {
  db ??= createDb(process.env.DATABASE_URL!) as unknown as AnyDb;
  return db;
}
