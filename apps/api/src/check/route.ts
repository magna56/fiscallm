import { hashKey, schema } from "@fiscallm/shared";
import type { MetricsDb } from "@fiscallm/shared/metrics";
import { checkPlanAllowance, type PlanAllowance } from "@fiscallm/shared/plan-limits";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AnyDb } from "../ingest/db";

// "May this user make another AI call, and how much of their plan is left?"
// Answers from the daily rollup, cached briefly per user so a busy backend
// costs a few small queries every few seconds, not on every request. The SDKs
// fail open: if this endpoint is slow or down, the call is allowed.
const TTL_MS = 10_000;
const MAX_ENTRIES = 5_000;
const cache = new Map<string, { value: PlanAllowance; plan: string | undefined; at: number }>();
const cacheKey = (appId: string, userId: string) => `${appId}\n${userId}`;

export function clearCheckCache() {
  cache.clear();
}

/** New usage arrived for these users: the next check counts it (on this instance). */
export function forgetChecks(appId: string, userIds: string[]) {
  for (const u of userIds) cache.delete(cacheKey(appId, u));
}

const body = z.object({ userId: z.string().min(1).max(256), plan: z.string().trim().min(1).max(128).optional() });

export function checkRoute(getDb: () => AnyDb) {
  return new Hono().post("/", async (c) => {
    const key = c.req.header("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!key) return c.json({ error: "missing ingest key" }, 401);

    const db = getDb();
    const [app] = await db
      .select({ id: schema.apps.id })
      .from(schema.apps)
      .where(eq(schema.apps.ingestKeyHash, await hashKey(key)))
      .limit(1);
    if (!app) return c.json({ error: "invalid ingest key" }, 401);

    const parsed = body.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json({ error: "send { userId } and, optionally, { plan }" }, 400);
    const { userId, plan } = parsed.data;

    const id = cacheKey(app.id, userId);
    const now = Date.now();
    let entry = cache.get(id);
    if (!entry || entry.plan !== plan || now - entry.at > TTL_MS) {
      entry = { value: await checkPlanAllowance(db as unknown as MetricsDb, app.id, userId, plan), plan, at: now };
      if (cache.size >= MAX_ENTRIES) cache.clear();
      cache.set(id, entry);
    }
    return c.json(entry.value);
  });
}
