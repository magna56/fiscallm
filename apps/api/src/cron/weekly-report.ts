import { schema } from "@fiscallm/shared";
import type { MetricsDb } from "@fiscallm/shared/metrics";
import { ownerEmail, sendWeeklyReport } from "@fiscallm/shared/report/send";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AnyDb } from "../ingest/db";

/** Monday 08:00 UTC: one email per app with activity last week. */
export function weeklyReportRoute(getDb: () => AnyDb) {
  return new Hono().get("/", async (c) => {
    const secret = process.env.CRON_SECRET;
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!secret || c.req.header("authorization") !== `Bearer ${secret}`) return c.json({ error: "unauthorized" }, 401);
    if (!resendApiKey) return c.json({ error: "RESEND_API_KEY is not set" }, 500);

    const db = getDb();
    const config = { resendApiKey, signingSecret: secret, baseUrl: process.env.PUBLIC_URL ?? "https://fiscallm.com" };
    const apps = await db
      .select({ id: schema.apps.id, name: schema.apps.name, ownerId: schema.apps.ownerId })
      .from(schema.apps)
      .where(eq(schema.apps.weeklyEmail, true));

    const results: Record<string, unknown> = {};
    // One app at a time: keeps the database connection and Resend's rate limit happy.
    for (const app of apps) {
      const to = await ownerEmail(db as unknown as MetricsDb, app.ownerId);
      if (!to) {
        results[app.id] = "no-owner-email";
        continue;
      }
      results[app.id] = await sendWeeklyReport(db as unknown as MetricsDb, app, to, config).catch((e: Error) => ({ error: e.message }));
    }
    return c.json({ apps: apps.length, results });
  });
}
