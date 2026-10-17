import { schema } from "@fiscallm/shared";
import { lt } from "drizzle-orm";
import { Hono } from "hono";
import type { AnyDb } from "../ingest/db";

export const RAW_RETENTION_DAYS = 90;

/**
 * Deletes raw AI events past the retention window promised in the privacy
 * policy. daily_user_cost keeps the totals. Run daily by Vercel Cron, which
 * sends `Authorization: Bearer $CRON_SECRET` when that variable is set.
 */
export function retentionRoute(getDb: () => AnyDb) {
  return new Hono().get("/", async (c) => {
    const secret = process.env.CRON_SECRET;
    if (secret && c.req.header("authorization") !== `Bearer ${secret}`) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const cutoff = new Date(Date.now() - RAW_RETENTION_DAYS * 86_400_000);
    const deleted = await getDb()
      .delete(schema.aiEvents)
      .where(lt(schema.aiEvents.ts, cutoff))
      .returning({ id: schema.aiEvents.id });
    return c.json({ deleted: deleted.length, before: cutoff.toISOString() });
  });
}
