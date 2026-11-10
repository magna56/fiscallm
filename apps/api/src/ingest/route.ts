import { Hono } from "hono";
import type { AnyDb } from "./db";
import { appForKey, bearer, capMessage, ingestEvents, overMonthlyCap } from "./pipeline";
import { batchSchema } from "./validate";

const MAX_BODY_BYTES = 1024 * 1024;

export function eventsRoute(getDb: () => AnyDb) {
  return new Hono().post("/", async (c) => {
    // Not hono's bodyLimit: its stream wrapper never finishes reading the
    // body on Vercel's Node runtime. Vercel itself caps bodies at 4.5 MB.
    if (Number(c.req.header("content-length") ?? 0) > MAX_BODY_BYTES) {
      return c.json({ error: "body too large" }, 413);
    }

    const key = bearer(c.req.header("authorization"));
    if (!key) return c.json({ error: "missing ingest key" }, 401);

    const db = getDb();
    const app = await appForKey(db, key);
    if (!app) return c.json({ error: "invalid ingest key" }, 401);

    const blocked = await overMonthlyCap(db, app.id);
    if (blocked) {
      // 403, not 429: the SDKs retry a 429 and would stay silent about the drop.
      return c.json({ error: capMessage(blocked), limit: blocked.limit, used: blocked.used, resetsAt: blocked.resetsAt }, 403);
    }

    const body = await c.req.json().catch(() => undefined);
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 20)
        .map((i) => ({ path: i.path.join("."), message: i.message }));
      return c.json({ error: "invalid events", issues }, 400);
    }

    const result = await ingestEvents(db, app.id, parsed.data.events);
    return c.json(result, 202);
  });
}
