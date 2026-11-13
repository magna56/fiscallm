import { openSecret, schema } from "@fiscallm/shared";
import { waitUntil } from "@vercel/functions";
import { and, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";
import { Hono } from "hono";
import type { AnyDb } from "../ingest/db";
import { capMessage, ingestEvents, overMonthlyCap, tsInRange } from "../ingest/pipeline";
import { DAY } from "./http";
import { pullSource } from ".";
import { type PullSource, SourceError } from "./types";

// Reading a provider's usage API for one app: take the row's lock, read from
// where the last sync stopped, store what was read, and record how far it
// got. A sync stops after a time budget; the route then starts the next one.

const CHUNK = 500;
const BUDGET_MS = 40_000;
// How long a lock holds if a sync dies without releasing it.
const LOCK_MS = 120_000;

export interface SyncResult {
  stored: number;
  /** Stopped at the time budget with more to read. */
  more: boolean;
  error?: string;
}

export async function syncSource(
  db: AnyDb,
  appId: string,
  source: PullSource,
  opts: { fetch?: typeof fetch; now?: Date; budgetMs?: number } = {},
): Promise<SyncResult | "busy" | "missing"> {
  const now = opts.now ?? new Date();
  const where = and(eq(schema.appSources.appId, appId), eq(schema.appSources.source, source.id));
  const [row] = await db
    .update(schema.appSources)
    .set({ lockedUntil: new Date(Date.now() + LOCK_MS) })
    .where(and(where, or(isNull(schema.appSources.lockedUntil), lt(schema.appSources.lockedUntil, new Date()))))
    .returning();
  if (!row) {
    const [exists] = await db.select({ appId: schema.appSources.appId }).from(schema.appSources).where(where).limit(1);
    return exists ? "busy" : "missing";
  }

  const result: SyncResult = { stored: 0, more: false };
  try {
    const secret = process.env.CRON_SECRET;
    const key = secret ? await openSecret(secret, row.keyCipher).catch(() => null) : null;
    if (!key) throw new SourceError("The saved key could not be read. Connect the source again.");

    // Tools of this app that send their own events, so a provider's report
    // of the same calls can be skipped.
    const recent = await db
      .selectDistinct({ source: schema.aiEvents.source })
      .from(schema.aiEvents)
      .where(and(eq(schema.aiEvents.appId, appId), isNotNull(schema.aiEvents.source), gt(schema.aiEvents.ts, new Date(now.getTime() - 7 * DAY))));

    result.more = await source.pull({
      key,
      since: row.syncedUntil ?? new Date(now.getTime() - source.firstDays * DAY),
      now,
      deadline: Date.now() + (opts.budgetMs ?? BUDGET_MS),
      fetch: opts.fetch ?? fetch,
      pushing: new Set(recent.map((r) => r.source!)),
      async store(events) {
        const fresh = events.filter((e) => tsInRange(e.ts)).map((e) => ({ ...e, source: source.id }));
        if (fresh.length === 0) return;
        const blocked = await overMonthlyCap(db, appId);
        if (blocked) throw new SourceError(capMessage(blocked));
        for (let i = 0; i < fresh.length; i += CHUNK) {
          result.stored += (await ingestEvents(db, appId, fresh.slice(i, i + CHUNK))).accepted;
        }
      },
      async progress(until) {
        await db.update(schema.appSources).set({ syncedUntil: until }).where(where);
      },
    });
  } catch (e) {
    if (e instanceof SourceError) result.error = e.message;
    else {
      console.error(`sync of ${source.id} failed for ${appId}`, e);
      result.error = "The sync failed. It is tried again with the next one.";
    }
  }
  await db.update(schema.appSources).set({ lastSyncAt: new Date(), lastError: result.error ?? null, lockedUntil: null }).where(where);
  return result;
}

// Each sync starts the next while there is more to read, up to this many in
// a row; the daily cron picks up from there.
const MAX_HOPS = 30;

/** Starts a sync in its own function call, so a long one does not hold up the caller. */
export function startSync(appId: string, source: string, hop = 0) {
  const secret = process.env.CRON_SECRET;
  const base = process.env.PUBLIC_URL ?? "https://fiscallm.com";
  if (!secret) return Promise.resolve();
  return fetch(`${base}/api/sources/sync`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ appId, source, hop }),
    signal: AbortSignal.timeout(10_000),
  })
    .then(() => undefined)
    .catch(() => undefined);
}

/**
 * POST /api/sources/check: whether a key works, for the dashboard before it
 * saves one. POST /api/sources/sync: one sync of one app's source, answered
 * at once and run after the response. Both are for the server only.
 */
export function syncRoute(getDb: () => AnyDb, f: typeof fetch = fetch) {
  const route = new Hono();
  route.use(async (c, next) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || c.req.header("authorization") !== `Bearer ${secret}`) return c.json({ error: "unauthorized" }, 401);
    await next();
  });

  route.post("/check", async (c) => {
    const body = ((await c.req.json().catch(() => ({}))) ?? {}) as { source?: string; key?: string };
    const source = body.source ? pullSource(body.source) : undefined;
    if (!source || typeof body.key !== "string") return c.json({ error: "source and key required" }, 400);
    return c.json({ problem: await source.check(body.key, f) });
  });

  return route.post("/sync", async (c) => {
    const body = ((await c.req.json().catch(() => ({}))) ?? {}) as { appId?: string; source?: string; hop?: number };
    const source = body.source ? pullSource(body.source) : undefined;
    if (!body.appId || !source) return c.json({ error: "appId and a known source required" }, 400);
    const hop = Number(body.hop) || 0;
    const appId = body.appId;

    const work = syncSource(getDb(), appId, source)
      .then(async (r) => {
        if (typeof r === "string") return;
        console.log(`sync ${source.id} for ${appId}: ${r.stored} stored${r.error ? `, ${r.error}` : ""}`);
        if (r.more && !r.error && hop < MAX_HOPS) await startSync(appId, source.id, hop + 1);
      })
      .catch((e) => console.error("sync failed", appId, source.id, e));
    waitUntil(work);
    return c.json({ accepted: true }, 202);
  });
}
