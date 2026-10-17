import { PGlite } from "@electric-sql/pglite";
import { schema, sealSecret } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "../../ingest/db";
import { RcApiError, type RcApi, type RcPurchase, type RcSubscription, type RcTransaction } from "./client";
import { convertCustomer } from "./convert";
import { importCutoff } from "@fiscallm/shared/rc-import";
import type { MetricsDb } from "@fiscallm/shared/metrics";
import { runImportChunk } from "./run";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 17);
const SECRET = "server-secret";
const money = (gross: number) => ({ currency: "USD", gross, tax: gross * 0.1, commission: gross * 0.15, proceeds: gross * 0.75 });

const sub = (id: string, o: Partial<RcSubscription> = {}): RcSubscription => ({
  id,
  customer_id: "c",
  product_id: "prod_rc",
  starts_at: NOW - 60 * DAY,
  current_period_starts_at: NOW - 10 * DAY,
  current_period_ends_at: NOW + 20 * DAY,
  ends_at: NOW + 20 * DAY,
  gives_access: true,
  auto_renewal_status: "will_renew",
  status: "active",
  environment: "production",
  store: "app_store",
  ...o,
});
const tx = (id: string, daysAgo: number, gross: number, period = 30): RcTransaction => ({
  id,
  purchased_at: NOW - daysAgo * DAY,
  product_store_identifier: "pro_monthly",
  revenue_in_usd: money(gross),
  expiration_date: NOW - daysAgo * DAY + period * DAY,
});

describe("convertCustomer", () => {
  it("turns a trial, conversion and renewal into webhook-shaped events", () => {
    const rows = convertCustomer(
      "app",
      { customerId: "c", subscriptions: [{ subscription: sub("s1"), transactions: [tx("t2", 40, 9.99), tx("t1", 47, 0, 7), tx("t3", 10, 9.99)] }], purchases: [] },
      new Date(NOW),
    );
    expect(rows.map((r) => [r.id, r.type, r.periodType, r.isTrialConversion])).toEqual([
      ["import:s1:t1", "INITIAL_PURCHASE", "TRIAL", null],
      ["import:s1:t2", "RENEWAL", "NORMAL", true],
      ["import:s1:t3", "RENEWAL", "NORMAL", false],
    ]);
    expect(rows[1]).toMatchObject({ productId: "pro_monthly", priceUsd: "9.99", taxPct: "0.1", commissionPct: "0.15", store: "APP_STORE", environment: "PRODUCTION" });
    expect(Number(rows[1]!.netUsd)).toBeCloseTo(7.4925);
  });

  it("skips everything on or after the cutoff", () => {
    const rows = convertCustomer(
      "app",
      { customerId: "c", subscriptions: [{ subscription: sub("s1"), transactions: [tx("old", 40, 9.99), tx("new", 10, 9.99)] }], purchases: [] },
      new Date(NOW - 20 * DAY),
    );
    expect(rows.map((r) => r.id)).toEqual(["import:s1:old"]);
  });

  it("adds expiry and cancellation state", () => {
    const rows = convertCustomer(
      "app",
      {
        customerId: "c",
        subscriptions: [
          { subscription: sub("gone", { status: "expired", gives_access: false, ends_at: NOW - 5 * DAY }), transactions: [tx("a", 35, 9.99)] },
          { subscription: sub("ending", { auto_renewal_status: "will_not_renew" }), transactions: [tx("b", 10, 9.99)] },
        ],
        purchases: [],
      },
      new Date(NOW),
    );
    expect(rows.map((r) => r.type)).toEqual(["INITIAL_PURCHASE", "EXPIRATION", "INITIAL_PURCHASE", "CANCELLATION"]);
  });

  it("uses subscription totals for stores without transaction history", () => {
    const s = sub("st", { store: "test_store", starts_at: NOW - 20 * DAY, current_period_ends_at: NOW + 10 * DAY, total_revenue_in_usd: money(79.99) });
    const rows = convertCustomer("app", { customerId: "c", subscriptions: [{ subscription: s, transactions: null }] , purchases: [] }, new Date(NOW));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "import:st:summary", type: "INITIAL_PURCHASE", periodType: "NORMAL", store: "TEST_STORE", priceUsd: "79.99" });
    expect(Number(rows[0]!.netUsd)).toBeCloseTo(59.9925);
    const trial = convertCustomer("app", { customerId: "c", subscriptions: [{ subscription: { ...s, status: "trialing", total_revenue_in_usd: money(0) }, transactions: null }], purchases: [] }, new Date(NOW));
    expect(trial[0]!.periodType).toBe("TRIAL");
  });

  it("imports one-time purchases and refunds", () => {
    const p: RcPurchase = { id: "p1", product_id: "lifetime", purchased_at: NOW - 3 * DAY, revenue_in_usd: money(99.99), store: "play_store", environment: "production", status: "refunded" };
    const rows = convertCustomer("app", { customerId: "c", subscriptions: [], purchases: [p] }, new Date(NOW));
    expect(rows.map((r) => [r.type, r.priceUsd])).toEqual([
      ["NON_RENEWING_PURCHASE", "99.99"],
      ["CANCELLATION", "-99.99"],
    ]);
    expect(Number(rows[0]!.netUsd) + Number(rows[1]!.netUsd)).toBeCloseTo(0);
  });
});

// ---- runImportChunk against PGlite and a fake RevenueCat ----

type Customer = { aliases: string[]; subs: { s: RcSubscription; txs: RcTransaction[] }[]; purchases: RcPurchase[] };

function fakeApi(customers: Record<string, Customer>, pageSize = 2, fail?: RcApiError): RcApi & { calls: number } {
  const ids = Object.keys(customers).sort();
  const api = {
    calls: 0,
    async customers(cursor: string | null) {
      api.calls++;
      if (fail) throw fail;
      const start = cursor ? ids.indexOf(cursor) + 1 : 0;
      const page = ids.slice(start, start + pageSize);
      return { ids: page, more: start + pageSize < ids.length };
    },
    aliases: async (id: string) => customers[id]!.aliases,
    subscriptions: async (id: string) => customers[id]!.subs.map((x) => x.s),
    transactions: async (sid: string) => {
      const found = Object.values(customers).flatMap((c) => c.subs).find((x) => x.s.id === sid)!;
      // Like RevenueCat: only App Store and Play Store have transactions.
      if (!["app_store", "play_store"].includes(found.s.store)) throw new RcApiError(400, "not supported");
      return found.txs;
    },
    purchases: async (id: string) => customers[id]!.purchases,
    productNames: async () => new Map([["prod_rc", "pro_monthly"]]),
  };
  return api;
}

let db: AnyDb;
let appId: string;

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: fileURLToPath(new URL("../../../../../packages/shared/drizzle", import.meta.url)) });
  db = pg as unknown as AnyDb;
});

beforeEach(async () => {
  await db.delete(schema.apps);
  const [app] = await db
    .insert(schema.apps)
    .values({ name: "t", ownerId: crypto.randomUUID(), ingestKeyHash: crypto.randomUUID(), rcWebhookSecret: "x" })
    .returning();
  appId = app!.id;
});

async function startImport(cutoff = new Date(NOW)) {
  await db.insert(schema.rcImports).values({
    appId,
    status: "running",
    projectId: "proj",
    keyCipher: await sealSecret(SECRET, "sk_test"),
    cutoff,
  });
}

const job = async () => (await db.select().from(schema.rcImports).where(eq(schema.rcImports.appId, appId)))[0]!;
const subscriber = async (user: string) => (await db.select().from(schema.subscribers).where(eq(schema.subscribers.userId, user)))[0];
const now = () => new Date(NOW);

const CUSTOMERS: Record<string, Customer> = {
  a: { aliases: ["a", "$RCAnonymousID:1"], subs: [{ s: sub("sa"), txs: [tx("t1", 47, 0, 7), tx("t2", 40, 9.99), tx("t3", 10, 9.99)] }], purchases: [] },
  b: { aliases: ["b"], subs: [{ s: sub("sb", { status: "expired", gives_access: false, ends_at: NOW - 5 * DAY }), txs: [tx("t4", 35, 9.99)] }], purchases: [] },
  d: { aliases: ["d"], subs: [{ s: sub("sd", { store: "stripe", starts_at: NOW - 15 * DAY, total_revenue_in_usd: money(20) }), txs: [] }], purchases: [] },
  c: { aliases: ["c"], subs: [], purchases: [{ id: "p1", product_id: "lifetime", purchased_at: NOW - 3 * DAY, revenue_in_usd: money(50), store: "app_store", environment: "production", status: "owned" }] },
};

describe("runImportChunk", () => {
  it("imports every customer, rebuilds subscribers and forgets the key", async () => {
    await startImport();
    const api = fakeApi(CUSTOMERS);
    expect(await runImportChunk(db, appId, () => api, SECRET, 60_000, now)).toBe("done");

    const j = await job();
    expect(j).toMatchObject({ status: "done", customersDone: 4, eventsImported: 7, keyCipher: null, error: null });
    expect(Number((await subscriber("d"))!.netRevenueUsd)).toBeCloseTo(15);
    // Named like webhooks do, via the product list.
    expect((await subscriber("d"))!.productId).toBe("pro_monthly");
    expect(await subscriber("a")).toMatchObject({ state: "paid", productId: "pro_monthly" });
    expect(Number((await subscriber("a"))!.netRevenueUsd)).toBeCloseTo(14.985);
    expect((await subscriber("a"))!.convertedAt).not.toBeNull();
    expect((await subscriber("b"))!.state).toBe("expired");
    expect((await subscriber("c"))!.state).toBe("paid");

    const alias = await db.select().from(schema.userAliases).where(eq(schema.userAliases.alias, "$RCAnonymousID:1"));
    expect(alias[0]!.canonicalUserId).toBe("a");
  });

  it("stops at the time budget and resumes from the cursor", async () => {
    await startImport();
    const api = fakeApi(CUSTOMERS, 1);
    expect(await runImportChunk(db, appId, () => api, SECRET, -1, now)).toBe("more");
    expect(await job()).toMatchObject({ status: "running", customersDone: 1, cursor: "a" });
    expect(await runImportChunk(db, appId, () => api, SECRET, -1, now)).toBe("more");
    expect(await runImportChunk(db, appId, () => api, SECRET, 60_000, now)).toBe("done");
    expect((await job()).customersDone).toBe(4);
  });

  it("re-running adds nothing twice", async () => {
    await startImport();
    await runImportChunk(db, appId, () => fakeApi(CUSTOMERS), SECRET, 60_000, now);
    await db.delete(schema.rcImports);
    await startImport();
    await runImportChunk(db, appId, () => fakeApi(CUSTOMERS), SECRET, 60_000, now);
    expect((await job()).eventsImported).toBe(0);
    expect(Number((await subscriber("a"))!.netRevenueUsd)).toBeCloseTo(14.985);
  });

  it("leaves history after the first webhook to the webhook", async () => {
    // A webhook renewal already covers the latest period.
    await db.insert(schema.rcEvents).values({
      appId,
      id: "evt_webhook",
      type: "RENEWAL",
      appUserId: "a",
      originalAppUserId: "a",
      purchasedAt: new Date(NOW - 10 * DAY),
      eventTs: new Date(NOW - 10 * DAY),
      priceUsd: "9.99",
      netUsd: "7.4925",
      environment: "PRODUCTION",
      raw: {},
    });
    const cutoff = await importCutoff(db as unknown as MetricsDb, appId);
    expect(cutoff.getTime()).toBe(NOW - 10 * DAY);
    await startImport(cutoff);
    await runImportChunk(db, appId, () => fakeApi({ a: CUSTOMERS.a! }), SECRET, 60_000, now);
    const events = await db.select({ id: schema.rcEvents.id }).from(schema.rcEvents);
    expect(events.map((e) => e.id).sort()).toEqual(["evt_webhook", "import:sa:t1", "import:sa:t2"]);
    expect(Number((await subscriber("a"))!.netRevenueUsd)).toBeCloseTo(14.985);
  });

  it("fails with a clear message on a bad key and clears it", async () => {
    await startImport();
    const result = await runImportChunk(db, appId, () => fakeApi(CUSTOMERS, 2, new RcApiError(401, "nope")), SECRET, 60_000, now);
    expect(result).toBe("stopped");
    const j = await job();
    expect(j.status).toBe("failed");
    expect(j.error).toContain("refused the key");
    expect(j.keyCipher).toBeNull();
  });

  it("lets only one chunk run at a time", async () => {
    await startImport();
    await db.update(schema.rcImports).set({ lockedUntil: new Date(Date.now() + 60_000) });
    expect(await runImportChunk(db, appId, () => fakeApi(CUSTOMERS), SECRET, 60_000, now)).toBe("busy");
  });

  it("does nothing for a cancelled import", async () => {
    await startImport();
    await db.update(schema.rcImports).set({ status: "cancelled" });
    const api = fakeApi(CUSTOMERS);
    expect(await runImportChunk(db, appId, () => api, SECRET, 60_000, now)).toBe("stopped");
    expect(api.calls).toBe(0);
  });
});
