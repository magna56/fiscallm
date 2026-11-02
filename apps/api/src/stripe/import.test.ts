import { PGlite } from "@electric-sql/pglite";
import { schema } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "../ingest/db";
import { importDone, type ImportState, runStripeImportChunk, type StripeGet } from "./import";
import { mapStripeEvent } from "./map";
import { stripeContext, storeStripeEvents } from "./route";

let db: AnyDb;
let app: { id: string; testMode: boolean };
const DAY = 86_400_000;
const sec = (ms: number) => Math.floor(ms / 1000);
const NOW = Date.now();
const since = sec(NOW - 365 * DAY);
const start = (): ImportState => ({ phase: 0, since, stored: 0, skipped: 0 });

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: fileURLToPath(new URL("../../../../packages/shared/drizzle", import.meta.url)) });
  db = pg as unknown as AnyDb;
});

beforeEach(async () => {
  await db.delete(schema.apps);
  const [row] = await db.insert(schema.apps).values({ name: "t", ownerId: crypto.randomUUID(), ingestKeyHash: "h", rcWebhookSecret: "x" }).returning();
  app = { id: row!.id, testMode: false };
});

const invoice = (id: string, user: string, daysAgo: number, reason = "subscription_cycle") => ({
  id,
  customer: `cus_${user}`,
  currency: "usd",
  amount_paid: 2000,
  tax: 0,
  livemode: true,
  billing_reason: reason,
  subscription: `sub_${user}`,
  subscription_details: { metadata: { user_id: user } },
  status_transitions: { paid_at: sec(NOW - daysAgo * DAY) },
  lines: { data: [{ price: { id: "price_pro" }, period: { end: sec(NOW + (30 - daysAgo) * DAY) } }] },
});

/** A fake Stripe API serving fixed lists, one object per page to exercise paging. */
function fakeStripe(lists: Record<string, Record<string, unknown>[]>): StripeGet & { calls: string[] } {
  const calls: string[] = [];
  const get = (async (path: string, params: Record<string, string>) => {
    const key = path === "/v1/subscriptions" ? `${path}:${params.status}` : path;
    calls.push(key);
    const all = lists[key] ?? [];
    const from = params.starting_after ? all.findIndex((o) => o.id === params.starting_after) + 1 : 0;
    return { data: all.slice(from, from + 1), has_more: from + 1 < all.length };
  }) as StripeGet & { calls: string[] };
  get.calls = calls;
  return get;
}

const sub = async (u: string) => (await db.select().from(schema.subscribers).where(eq(schema.subscribers.userId, u)))[0];

describe("Stripe history import", () => {
  it("imports paid invoices, refunds, trials and ended subscriptions across pages", async () => {
    const get = fakeStripe({
      "/v1/invoices": [invoice("in_1", "u1", 40, "subscription_create"), invoice("in_2", "u1", 10), invoice("in_3", "u2", 5, "subscription_create")],
      "/v1/refunds": [{ id: "re_1", status: "succeeded", created: sec(NOW - 2 * DAY), charge: { id: "ch_3", customer: "cus_u2", currency: "usd", amount_refunded: 2000, livemode: true, metadata: { user_id: "u2" } } }],
      "/v1/subscriptions:trialing": [{ id: "sub_u3", customer: "cus_u3", status: "trialing", trial_start: sec(NOW - DAY), trial_end: sec(NOW + 6 * DAY), metadata: { user_id: "u3" }, items: { data: [{ price: { id: "price_pro" } }] } }],
      "/v1/subscriptions:canceled": [
        { id: "sub_old", customer: "cus_old", ended_at: sec(NOW - 400 * DAY), metadata: { user_id: "old" } },
        { id: "sub_u4", customer: "cus_u4", ended_at: sec(NOW - 3 * DAY), metadata: { user_id: "u4" }, items: { data: [{ price: { id: "price_pro" } }] } },
      ],
    });
    const end = await runStripeImportChunk(db, app, get, start(), Date.now() + 60_000);
    expect(importDone(end)).toBe(true);
    expect(end).toMatchObject({ stored: 6, skipped: 1 });

    expect(Number((await sub("u1"))!.netRevenueUsd)).toBeCloseTo(2 * (20 - 0.88), 2);
    expect((await sub("u2"))!.state).toBe("expired");
    expect((await sub("u3"))!.state).toBe("trial");
    expect(await sub("old")).toBeUndefined();
  });

  it("does not count an invoice twice when the webhook already stored it, or on a re-run", async () => {
    const webhookEvent = { id: "evt_live", type: "invoice.paid", created: sec(NOW - DAY), livemode: true, data: { object: invoice("in_9", "u9", 1) } };
    await storeStripeEvents(db, app, await mapStripeEvent(webhookEvent, stripeContext(db, app.id)));

    const get = fakeStripe({ "/v1/invoices": [invoice("in_9", "u9", 1), invoice("in_8", "u9", 31)] });
    expect(await runStripeImportChunk(db, app, get, start(), Date.now() + 60_000)).toMatchObject({ stored: 1, skipped: 1 });
    expect(await runStripeImportChunk(db, app, get, start(), Date.now() + 60_000)).toMatchObject({ stored: 0, skipped: 2 });
    expect(Number((await sub("u9"))!.netRevenueUsd)).toBeCloseTo(2 * (20 - 0.88), 2);
  });

  it("stops at the deadline and resumes from the cursor", async () => {
    const get = fakeStripe({ "/v1/invoices": [invoice("in_a", "ua", 3), invoice("in_b", "ub", 2)] });
    const paused = await runStripeImportChunk(db, app, get, start(), 0);
    expect(paused).toMatchObject({ phase: 0, stored: 0 });
    const done = await runStripeImportChunk(db, app, get, { ...paused, cursor: "in_a", stored: 1 }, Date.now() + 60_000);
    expect(importDone(done)).toBe(true);
    expect(get.calls.filter((c) => c === "/v1/invoices")).toHaveLength(1);
  });
});
