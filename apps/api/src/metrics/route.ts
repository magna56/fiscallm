import { breakdown, lastDays, type MetricsDb, overview, plans, users } from "@fiscallm/shared/metrics";
import { type Context, Hono } from "hono";
import type { AnyDb } from "../ingest/db";
import { appForKey, bearer } from "../ingest/pipeline";

// Read the dashboard's numbers as JSON, with the app's key: for scripts,
// internal tools and AI agents (the MCP server answers from the same calls).

export const clampDays = (v: unknown, fallback = 30) => {
  const n = Math.round(Number(v ?? fallback));
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 365) : fallback;
};
export const clampLimit = (v: unknown, fallback = 50) => {
  const n = Math.round(Number(v ?? fallback));
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 500) : fallback;
};

export async function readMetric(
  db: AnyDb,
  appId: string,
  what: "overview" | "users" | "plans" | "breakdown",
  opts: { days?: unknown; losingOnly?: boolean; limit?: unknown } = {},
) {
  const mdb = db as unknown as MetricsDb;
  const days = clampDays(opts.days);
  const range = lastDays(days);
  if (what === "overview") return { days, range, ...(await overview(mdb, appId, range)) };
  if (what === "users") {
    return { days, range, order: "margin, worst first", users: await users(mdb, appId, range, { losingOnly: opts.losingOnly, limit: clampLimit(opts.limit) }) };
  }
  if (what === "plans") return { days, range, plans: await plans(mdb, appId, range) };
  return { days, ...(await breakdown(mdb, appId, range)) };
}

export function metricsRoute(getDb: () => AnyDb) {
  const route = new Hono();
  const handle = (what: Parameters<typeof readMetric>[2]) => async (c: Context) => {
    const key = bearer(c.req.header("authorization"));
    if (!key) return c.json({ error: "missing key: send Authorization: Bearer <ingest key>" }, 401);
    const db = getDb();
    const app = await appForKey(db, key);
    if (!app) return c.json({ error: "invalid key" }, 401);
    const losing = c.req.query("losing");
    return c.json(await readMetric(db, app.id, what, { days: c.req.query("days"), limit: c.req.query("limit"), losingOnly: losing === "1" || losing === "true" }));
  };
  route.get("/overview", handle("overview"));
  route.get("/users", handle("users"));
  route.get("/plans", handle("plans"));
  route.get("/breakdown", handle("breakdown"));
  return route;
}
