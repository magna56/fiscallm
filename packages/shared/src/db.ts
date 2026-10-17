import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Use Supabase's transaction pooler (port 6543) from serverless functions;
// it does not support prepared statements.
export function createDb(url: string) {
  return drizzle(postgres(url, { prepare: false, max: 1 }), { schema });
}

export type Db = ReturnType<typeof createDb>;
