import { eventsThisMonth, monthlyEventCap, nextMonthStart } from "@fiscallm/shared/limits";
import type { MetricsDb } from "@fiscallm/shared/metrics";
import type { AnyDb } from "./db";

// The count comes from the daily rollup and is cached for a minute per app,
// so the cap costs one small query a minute, not one per request. The cap is
// approximate: a busy minute, or several server instances, can overshoot a bit.
const TTL_MS = 60_000;
const cache = new Map<string, { used: number; at: number }>();

export function clearUsageCache() {
  cache.clear();
}

export interface LimitBlock {
  limit: number;
  used: number;
  resetsAt: string;
}

/** Null when the app may send events, otherwise why not. */
export async function overMonthlyCap(db: AnyDb, appId: string, now = new Date()): Promise<LimitBlock | null> {
  const cap = monthlyEventCap();
  if (cap === null) return null;
  let entry = cache.get(appId);
  if (!entry || now.getTime() - entry.at > TTL_MS) {
    entry = { used: await eventsThisMonth(db as unknown as MetricsDb, appId, now), at: now.getTime() };
    cache.set(appId, entry);
  }
  return entry.used >= cap ? { limit: cap, used: entry.used, resetsAt: nextMonthStart(now) } : null;
}

/** Keeps the cached count moving between refreshes. */
export function noteAccepted(appId: string, accepted: number) {
  const entry = cache.get(appId);
  if (entry) entry.used += accepted;
}
