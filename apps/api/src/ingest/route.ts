import { hashKey, schema } from "@fiscallm/shared";
import { checkUserBudgets, deliverAlerts } from "@fiscallm/shared/alerts";
import type { MetricsDb } from "@fiscallm/shared/metrics";
import { waitUntil } from "@vercel/functions";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AnyDb } from "./db";
import { noteAccepted, overMonthlyCap } from "./limit";
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

    const blocked = await overMonthlyCap(db, app.id);
    if (blocked) {
      // 403, not 429: the SDKs retry a 429 and would stay silent about the drop.
      return c.json(
        {
          error: `monthly event limit reached (${blocked.limit.toLocaleString("en-US")} events per app). It resets on ${blocked.resetsAt}. Self-host FiscaLLM for no limit, or open an issue if you need more.`,
          limit: blocked.limit,
          used: blocked.used,
          resetsAt: blocked.resetsAt,
        },
        403,
      );
    }

    const body = await c.req.json().catch(() => undefined);
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 20)
        .map((i) => ({ path: i.path.join("."), message: i.message }));
      return c.json({ error: "invalid events", issues }, 400);
    }

    // Sequential on purpose: concurrent queries on one connection are
    // pipelined, which Supabase's transaction pooler cannot handle.
    const prices = await loadPrices(db);
    const overrides = await loadOverrides(db, app.id);
    const rows = priceEvents(app.id, parsed.data.events, prices, overrides);
    const result = await storeEvents(db, rows);
    noteAccepted(app.id, result.accepted);
    if (result.accepted > 0) {
      // Budgets are checked after the response, so ingest stays fast.
      const userIds = [...new Set(parsed.data.events.map((e) => e.userId))];
      waitUntil(checkBudgets(db, app.id, userIds).catch((e) => console.error("alert check failed", e)));
    }
    return c.json(result, 202);
  });
}

async function checkBudgets(db: AnyDb, appId: string, userIds: string[]) {
  const mdb = db as unknown as MetricsDb;
  const alerts = await checkUserBudgets(mdb, appId, userIds);
  if (alerts.length === 0) return;
  const [app] = await db
    .select({ id: schema.apps.id, name: schema.apps.name, ownerId: schema.apps.ownerId, alertSecret: schema.apps.alertSecret })
    .from(schema.apps)
    .where(eq(schema.apps.id, appId));
  if (!app) return;
  await deliverAlerts(mdb, app, alerts, { resendApiKey: process.env.RESEND_API_KEY, baseUrl: process.env.PUBLIC_URL ?? "https://fiscallm.com" });
}
