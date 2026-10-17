import { sql } from "drizzle-orm";
import type { MetricsDb } from "./metrics";

/**
 * Where a RevenueCat history import stops: the first purchase the webhook
 * delivered, or now if none arrived yet. Earlier history only comes from
 * the import, later only from the webhook, so nothing counts twice.
 */
export async function importCutoff(db: MetricsDb, appId: string): Promise<Date> {
  const res = (await db.execute(sql`
    SELECT min(coalesce(purchased_at, event_ts)) AS first
    FROM rc_events
    WHERE app_id = ${appId}::uuid AND id NOT LIKE 'import:%' AND type <> 'TEST'`)) as unknown;
  const rows = (Array.isArray(res) ? res : (res as { rows: { first: string | Date | null }[] }).rows) as { first: string | Date | null }[];
  const first = rows[0]?.first;
  return first ? new Date(first) : new Date();
}
