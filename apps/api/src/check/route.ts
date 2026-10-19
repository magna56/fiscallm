import { hashKey, schema } from "@fiscallm/shared";
import { type Allowance, checkAllowance } from "@fiscallm/shared/alerts";
import type { MetricsDb } from "@fiscallm/shared/metrics";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AnyDb } from "../ingest/db";

// "May this user make another AI call?" Answers from the daily rollup, cached
// briefly per user so a busy backend costs one small query every few seconds,
// not one per request. The SDKs fail open: if this endpoint is slow or down,
// the call is allowed.
const TTL_MS = 10_000;
const MAX_ENTRIES = 5_000;
const cache = new Map<string, { value: Allowance; at: number }>();

export function clearCheckCache() {
  cache.clear();
}

const body = z.object({ userId: z.string().min(1).max(256) });

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
    if (!parsed.success) return c.json({ error: "send { userId }" }, 400);
    const { userId } = parsed.data;

    const id = `${app.id}:${userId}`;
    const now = Date.now();
    let entry = cache.get(id);
    if (!entry || now - entry.at > TTL_MS) {
      entry = { value: await checkAllowance(db as unknown as MetricsDb, app.id, userId), at: now };
      if (cache.size >= MAX_ENTRIES) cache.clear();
      cache.set(id, entry);
    }
    return c.json(entry.value);
  });
}
