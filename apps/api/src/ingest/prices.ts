import type { ModelPrice, PriceOverride, Rates } from "@fiscallm/shared";
import { schema } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import type { AnyDb } from "./db";

const num = (v: string | null) => (v === null ? undefined : Number(v));

const CACHE_MS = 5 * 60_000;
let cached: { at: number; prices: ModelPrice[] } | undefined;

// The price table changes rarely; each function instance keeps it 5 minutes.
export async function loadPrices(db: AnyDb): Promise<ModelPrice[]> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.prices;
  const rows = await db.select().from(schema.modelPrices);
  const prices = rows.map((r): ModelPrice => {
    const long =
      r.longContextThreshold !== null && r.longInputPerMtok !== null && r.longOutputPerMtok !== null
        ? {
            threshold: r.longContextThreshold,
            input: Number(r.longInputPerMtok),
            output: Number(r.longOutputPerMtok),
            cached: num(r.longCachedPerMtok),
            cacheWrite: num(r.longCacheWritePerMtok),
          }
        : undefined;
    return {
      provider: r.provider,
      model: r.model,
      effectiveFrom: r.effectiveFrom,
      input: Number(r.inputPerMtok),
      output: Number(r.outputPerMtok),
      cached: num(r.cachedPerMtok),
      cacheWrite: num(r.cacheWritePerMtok),
      long,
      units: r.unitPrices ?? undefined,
    };
  });
  cached = { at: Date.now(), prices };
  return prices;
}

export function clearPriceCache() {
  cached = undefined;
}

export async function loadOverrides(db: AnyDb, appId: string): Promise<PriceOverride[]> {
  const rows = await db
    .select()
    .from(schema.appPriceOverrides)
    .where(eq(schema.appPriceOverrides.appId, appId));
  return rows.map((r) => {
    const rates: Rates | undefined =
      r.inputPerMtok !== null && r.outputPerMtok !== null
        ? {
            input: Number(r.inputPerMtok),
            output: Number(r.outputPerMtok),
            cached: num(r.cachedPerMtok),
            cacheWrite: num(r.cacheWritePerMtok),
          }
        : undefined;
    return {
      provider: r.provider,
      model: r.model,
      effectiveFrom: r.effectiveFrom,
      discountPct: num(r.discountPct),
      rates,
    };
  });
}
