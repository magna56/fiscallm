import { hashKey, schema } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AnyDb } from "./db";
import { loadOverrides, loadPrices } from "./prices";
import { priceEvents, storeEvents } from "./store";
import { batchSchema } from "./validate";

export function eventsRoute(getDb: () => AnyDb) {
  return new Hono().post("/", bodyLimit({ maxSize: 1024 * 1024 }), async (c) => {
    const key = c.req.header("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!key) return c.json({ error: "missing ingest key" }, 401);

    const db = getDb();
    const [app] = await db
      .select({ id: schema.apps.id })
      .from(schema.apps)
      .where(eq(schema.apps.ingestKeyHash, await hashKey(key)))
      .limit(1);
    if (!app) return c.json({ error: "invalid ingest key" }, 401);

    const body = await c.req.json().catch(() => undefined);
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 20)
        .map((i) => ({ path: i.path.join("."), message: i.message }));
      return c.json({ error: "invalid events", issues }, 400);
    }

    const [prices, overrides] = await Promise.all([loadPrices(db), loadOverrides(db, app.id)]);
    const rows = priceEvents(app.id, parsed.data.events, prices, overrides);
    return c.json(await storeEvents(db, rows), 202);
  });
}
