import { schema } from "@fiscallm/shared";
import { checkDaily, deliverAlerts } from "@fiscallm/shared/alerts";
import type { MetricsDb } from "@fiscallm/shared/metrics";
import { inArray } from "drizzle-orm";
import { Hono } from "hono";
import type { AnyDb } from "../ingest/db";
import { deleteOldRawEvents } from "./retention";

/**
 * Daily at 07:00 UTC: raw-event retention, then the app-wide alert rules.
 * One job, as Vercel's Hobby plan limits how many crons a project has.
 */
export function dailyRoute(getDb: () => AnyDb) {
  return new Hono().get("/", async (c) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || c.req.header("authorization") !== `Bearer ${secret}`) return c.json({ error: "unauthorized" }, 401);
    const db = getDb();
    const deleted = await deleteOldRawEvents(db);

    const ruleApps = await db
      .selectDistinct({ appId: schema.alertRules.appId })
      .from(schema.alertRules)
      .where(inArray(schema.alertRules.kind, ["user_losing", "app_cost_share", "unpriced_model"]));
    let sent = 0;
    // One app at a time: see the note on pipelining in ingest/route.ts.
    for (const { appId } of ruleApps) {
      try {
        const alerts = await checkDaily(db as unknown as MetricsDb, appId);
        if (alerts.length === 0) continue;
        const [app] = await db
          .select({ id: schema.apps.id, name: schema.apps.name, ownerId: schema.apps.ownerId, alertSecret: schema.apps.alertSecret })
          .from(schema.apps)
          .where(inArray(schema.apps.id, [appId]));
        if (!app) continue;
        sent += (await deliverAlerts(db as unknown as MetricsDb, app, alerts, { resendApiKey: process.env.RESEND_API_KEY, baseUrl: process.env.PUBLIC_URL ?? "https://fiscallm.com" })).length;
      } catch (e) {
        console.error("daily alerts failed for", appId, e);
      }
    }
    return c.json({ retention: deleted, alertApps: ruleApps.length, alertsSent: sent });
  });
}
