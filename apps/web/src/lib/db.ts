import "server-only";
import { createDb, type Db } from "@fiscallm/shared/db";
import type { MetricsDb } from "@fiscallm/shared/metrics";

let db: Db | undefined;

// Supabase's transaction pooler: run queries one at a time, never with
// Promise.all on this connection (it cannot take pipelined queries).
export function getDb(): Db {
  db ??= createDb(process.env.DATABASE_URL!);
  return db;
}

export const metricsDb = () => getDb() as unknown as MetricsDb;
