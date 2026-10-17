import { and, eq, gte, sql } from "drizzle-orm";
import type { MetricsDb } from "./metrics";
import { dailyUserCost } from "./schema";

/**
 * Optional monthly event cap per app, from MONTHLY_EVENT_CAP. Unset, empty,
 * zero or invalid means no cap, which is the default for self-hosted copies.
 */
export function monthlyEventCap(value: string | undefined = process.env.MONTHLY_EVENT_CAP): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** First day of the current UTC month, YYYY-MM-DD. */
export function monthStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/** First day of the next UTC month, when the count starts again. */
export function nextMonthStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

/** Events accepted for the app so far this UTC month, from the daily rollup. */
export async function eventsThisMonth(db: MetricsDb, appId: string, now = new Date()): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${dailyUserCost.requests}), 0)::int` })
    .from(dailyUserCost)
    .where(and(eq(dailyUserCost.appId, appId), gte(dailyUserCost.day, monthStart(now))));
  return Number(row?.n ?? 0);
}
