// Copies MODEL_PRICES into the model_prices table. Safe to re-run.
import { existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { MODEL_PRICES } from "../src/pricing/prices";
import { modelPrices } from "../src/schema";

if (existsSync(".env")) process.loadEnvFile(".env");

const num = (n: number | undefined) => (n === undefined ? null : String(n));

const rows = MODEL_PRICES.map((p) => ({
  provider: p.provider,
  model: p.model,
  effectiveFrom: p.effectiveFrom,
  inputPerMtok: String(p.input),
  outputPerMtok: String(p.output),
  cachedPerMtok: num(p.cached),
  cacheWritePerMtok: num(p.cacheWrite),
  longContextThreshold: p.long?.threshold ?? null,
  longInputPerMtok: num(p.long?.input),
  longOutputPerMtok: num(p.long?.output),
  longCachedPerMtok: num(p.long?.cached),
  longCacheWritePerMtok: num(p.long?.cacheWrite),
}));

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

const excluded = (col: string) => sql.raw(`excluded.${col}`);
await db
  .insert(modelPrices)
  .values(rows)
  .onConflictDoUpdate({
    target: [modelPrices.provider, modelPrices.model, modelPrices.effectiveFrom],
    set: {
      inputPerMtok: excluded("input_per_mtok"),
      outputPerMtok: excluded("output_per_mtok"),
      cachedPerMtok: excluded("cached_per_mtok"),
      cacheWritePerMtok: excluded("cache_write_per_mtok"),
      longContextThreshold: excluded("long_context_threshold"),
      longInputPerMtok: excluded("long_input_per_mtok"),
      longOutputPerMtok: excluded("long_output_per_mtok"),
      longCachedPerMtok: excluded("long_cached_per_mtok"),
      longCacheWritePerMtok: excluded("long_cache_write_per_mtok"),
    },
  });

console.log(`Synced ${rows.length} prices.`);
await client.end();
