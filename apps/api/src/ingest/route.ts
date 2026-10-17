import { hashKey, schema } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AnyDb } from "./db";
import { loadOverrides, loadPrices } from "./prices";
import { priceEvents, storeEvents } from "./store";
import { batchSchema } from "./validate";

const MAX_BODY_BYTES = 1024 * 1024;

export function eventsRoute(getDb: () => AnyDb) {
  return new Hono().post("/", async (c) => {
    // Not hono's bodyLimit: its stream wrapper never finishes reading the
    // body on Vercel's Node runtime. Vercel itself caps bodies at 4.5 MB.
    if (Number(c.req.header("content-length") ?? 0) > MAX_BODY_BYTES) {
      return c.json({ error: "body too large" }, 413);
    }

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
