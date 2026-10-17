import { hashKey, schema } from "@fiscallm/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AnyDb } from "../ingest/db";
import { recompute, setAlias } from "../revenuecat/store";
import { revenueBatchSchema, toRcEvent } from "./convert";

/** POST /api/v1/revenue: purchases from any billing system, by ingest key. */
export function revenueRoute(getDb: () => AnyDb) {
  return new Hono().post("/", async (c) => {
    const key = c.req.header("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!key) return c.json({ error: "missing ingest key" }, 401);
    const db = getDb();
    const [app] = await db
      .select({ id: schema.apps.id, testMode: schema.apps.testMode })
      .from(schema.apps)
      .where(eq(schema.apps.ingestKeyHash, await hashKey(key)))
      .limit(1);
    if (!app) return c.json({ error: "invalid ingest key" }, 401);

    const parsed = revenueBatchSchema.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) {
      const issues = parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message }));
      return c.json({ error: "invalid events", issues }, 400);
    }

    const rows = parsed.data.events.map((e) => toRcEvent(app.id, e));
    const result = await db.transaction(async (tx) => {
      const inserted = await tx.insert(schema.rcEvents).values(rows).onConflictDoNothing().returning({ id: schema.rcEvents.id });
      // Users may already be known under a RevenueCat alias; keep that canonical id.
      const users = [...new Set(parsed.data.events.map((e) => e.userId))];
      for (const user of users) {
        const [known] = await tx
          .select({ c: schema.userAliases.canonicalUserId })
          .from(schema.userAliases)
          .where(and(eq(schema.userAliases.appId, app.id), eq(schema.userAliases.alias, user)));
        const canonical = known?.c ?? user;
        await setAlias(tx, app.id, [user], canonical);
        await recompute(tx, app, canonical, new Date());
      }
      return { accepted: inserted.length, duplicates: rows.length - inserted.length };
    });
    return c.json(result, 202);
  });
}
