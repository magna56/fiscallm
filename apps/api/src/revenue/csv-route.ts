import { schema } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AnyDb } from "../ingest/db";
import type { RowSource } from "./convert";
import { parseRevenueCsv } from "./csv";
import { storeRevenueEvents } from "./route";

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const CHUNK = 500;
const CSV_SOURCE: RowSource = { store: "CSV", idPrefix: "csv", rawSource: "csv-upload" };

/**
 * POST /api/import/revenue-csv: a revenue CSV uploaded on the dashboard.
 * The dashboard checks who is signed in and calls this with the server secret.
 */
export function revenueCsvRoute(getDb: () => AnyDb) {
  return new Hono().post("/", async (c) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || c.req.header("authorization") !== `Bearer ${secret}`) return c.json({ error: "unauthorized" }, 401);
    if (Number(c.req.header("content-length") ?? 0) > MAX_CSV_BYTES + 1024) return c.json({ error: "file too large (2 MB max)" }, 413);
    const { appId, csv } = ((await c.req.json().catch(() => ({}))) ?? {}) as { appId?: string; csv?: string };
    if (!appId || typeof csv !== "string") return c.json({ error: "appId and csv required" }, 400);

    const db = getDb();
    const [app] = await db.select({ id: schema.apps.id, testMode: schema.apps.testMode }).from(schema.apps).where(eq(schema.apps.id, appId)).limit(1);
    if (!app) return c.json({ error: "unknown app" }, 404);

    const { events, errors } = parseRevenueCsv(csv);
    let accepted = 0;
    let duplicates = 0;
    for (let i = 0; i < events.length; i += CHUNK) {
      const r = await storeRevenueEvents(db, app, events.slice(i, i + CHUNK), CSV_SOURCE);
      accepted += r.accepted;
      duplicates += r.duplicates;
    }
    return c.json({ accepted, duplicates, skipped: errors.length, errors: errors.slice(0, 20) }, 200);
  });
}
