import { cost, type ModelPrice, type PriceOverride, schema } from "@fiscallm/shared";
import { sql } from "drizzle-orm";
import type { AnyDb } from "./db";
import type { IngestEvent } from "./validate";

export interface IngestResult {
  accepted: number;
  duplicates: number;
  unpriced: number;
}

type AiEventRow = typeof schema.aiEvents.$inferInsert;

export function priceEvents(
  appId: string,
  events: IngestEvent[],
  prices: readonly ModelPrice[],
  overrides: readonly PriceOverride[],
): AiEventRow[] {
  return events.map((e) => {
    const base = {
      appId,
      id: e.id,
      userId: e.userId,
      ts: e.ts,
      provider: e.provider,
      model: e.model,
      inputTokens: e.inputTokens,
      outputTokens: e.outputTokens,
      cachedTokens: e.cachedTokens,
      cacheWriteTokens: e.cacheWriteTokens,
      units: e.units === undefined ? null : String(e.units),
      unit: e.unit ?? null,
      variant: e.variant ?? null,
      feature: e.feature ?? null,
      jobId: e.jobId ?? null,
    };
    if (e.costUsd !== undefined) {
      return { ...base, costUsd: String(e.costUsd), costSource: "client" as const };
    }
    const c = cost({ ...e, at: e.ts }, prices, overrides);
    return { ...base, costUsd: c ? String(c.costUsd) : null, costSource: c?.source ?? "table" };
  });
}

/**
 * Inserts events and adds the new ones to daily_user_cost in one
 * transaction. Duplicates (SDK retries) are skipped and not counted again.
 */
export async function storeEvents(db: AnyDb, rows: AiEventRow[]): Promise<IngestResult> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(schema.aiEvents)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: schema.aiEvents.id });
    const newIds = new Set(inserted.map((r) => r.id));
    const fresh = rows.filter((r) => newIds.has(r.id));

    // Micro-dollars as integers, so sums do not drift.
    const daily = new Map<string, { userId: string; day: string; micros: number; requests: number }>();
    for (const r of fresh) {
      const day = (r.ts as Date).toISOString().slice(0, 10);
      const key = `${r.userId}\u0000${day}`;
      const d = daily.get(key) ?? { userId: r.userId, day, micros: 0, requests: 0 };
      d.micros += Math.round(Number(r.costUsd ?? 0) * 1e8);
      d.requests += 1;
      daily.set(key, d);
    }

    if (daily.size > 0) {
      const appId = rows[0]!.appId;
      await tx
        .insert(schema.dailyUserCost)
        .values(
          [...daily.values()].map((d) => ({
            appId,
            userId: d.userId,
            day: d.day,
            costUsd: (d.micros / 1e8).toFixed(8),
            requests: d.requests,
          })),
        )
        .onConflictDoUpdate({
          target: [schema.dailyUserCost.appId, schema.dailyUserCost.userId, schema.dailyUserCost.day],
          set: {
            costUsd: sql`${schema.dailyUserCost.costUsd} + excluded.cost_usd`,
            requests: sql`${schema.dailyUserCost.requests} + excluded.requests`,
          },
        });
    }

    return {
      accepted: fresh.length,
      duplicates: rows.length - fresh.length,
      unpriced: fresh.filter((r) => r.costUsd === null).length,
    };
  });
}
