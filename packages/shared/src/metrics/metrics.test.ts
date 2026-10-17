import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import { breakdown, lastDays, type MetricsDb, overview, plans, trialCohorts, users } from "./index";

// Hand-checked dataset. Range: 1–16 Oct 2026; "now" is 16 Oct noon UTC.
//
// orig-1   SDK id anon-1. Trial 5–8 Oct, converted 8 Oct: $10 at 30% fee = $7.
//          Cost $1 (5th) + $2 (7th) in trial, $3 (9th) after, $5 on 20 Sep (out of range).
// paid-2   Bought pro_weekly 2 Oct, $5 at 30% = $3.50. Cost $6 on the 3rd: losing $2.50.
// trial-3  Trial from 12 Oct to 19 Oct (not over yet). Cost $0.50.
// free-4   No RevenueCat record. Cost $0.25.
// sb-5     Sandbox purchase of $100: excluded (app not in test mode).
// ref-6    Bought 3 Oct ($7 net), refunded 6 Oct (−$7). No cost.

const APP = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-16T12:00:00Z");
const RANGE = { from: "2026-10-01", to: "2026-10-17" };
const at = (d: string) => new Date(`${d}T10:00:00Z`);

let db: MetricsDb;

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  db = pg as unknown as MetricsDb;

  await db.insert(schema.apps).values({ id: APP, name: "t", ownerId: APP, ingestKeyHash: "h", rcWebhookSecret: "s" });

  const cost = (userId: string, day: string, costUsd: number) => ({ appId: APP, userId, day, costUsd: String(costUsd), requests: 1 });
  await db.insert(schema.dailyUserCost).values([
    cost("anon-1", "2026-10-05", 1),
    cost("anon-1", "2026-10-07", 2),
    cost("anon-1", "2026-10-09", 3),
    cost("anon-1", "2026-09-20", 5),
    cost("paid-2", "2026-10-03", 6),
    cost("trial-3", "2026-10-12", 0.5),
    cost("free-4", "2026-10-10", 0.25),
  ]);

  await db.insert(schema.userAliases).values(
    [
      ["orig-1", "orig-1"],
      ["anon-1", "orig-1"],
      ["paid-2", "paid-2"],
      ["trial-3", "trial-3"],
      ["ref-6", "ref-6"],
    ].map(([alias, canonicalUserId]) => ({ appId: APP, alias: alias!, canonicalUserId: canonicalUserId! })),
  );

  let n = 0;
  const rc = (user: string, type: string, o: Partial<typeof schema.rcEvents.$inferInsert>) => ({
    appId: APP,
    id: `e${++n}`,
    type,
    appUserId: user,
    originalAppUserId: user,
    environment: "PRODUCTION",
    eventTs: o.purchasedAt ?? NOW,
    raw: {},
    ...o,
  });
  await db.insert(schema.rcEvents).values([
    rc("orig-1", "INITIAL_PURCHASE", { periodType: "TRIAL", purchasedAt: at("2026-10-05"), expirationAt: at("2026-10-08"), priceUsd: "0", netUsd: "0" }),
    rc("orig-1", "RENEWAL", { periodType: "NORMAL", purchasedAt: at("2026-10-08"), priceUsd: "10", netUsd: "7", isTrialConversion: true }),
    rc("paid-2", "INITIAL_PURCHASE", { periodType: "NORMAL", purchasedAt: at("2026-10-02"), priceUsd: "5", netUsd: "3.5" }),
    rc("trial-3", "INITIAL_PURCHASE", { periodType: "TRIAL", purchasedAt: at("2026-10-12"), expirationAt: at("2026-10-19"), priceUsd: "0", netUsd: "0" }),
    rc("sb-5", "INITIAL_PURCHASE", { periodType: "NORMAL", purchasedAt: at("2026-10-04"), priceUsd: "100", netUsd: "70", environment: "SANDBOX" }),
    rc("ref-6", "INITIAL_PURCHASE", { periodType: "NORMAL", purchasedAt: at("2026-10-03"), priceUsd: "10", netUsd: "7" }),
    // A refund keeps the original purchase date but is counted when it happens.
    rc("ref-6", "CANCELLATION", { purchasedAt: at("2026-10-03"), eventTs: at("2026-10-06"), priceUsd: "-10", netUsd: "-7" }),
    rc("orig-1", "CANCELLATION", { eventTs: at("2026-10-10"), priceUsd: "0", netUsd: "0" }),
  ]);

  const sub = (userId: string, state: "trial" | "paid" | "expired", productId: string, convertedAt: Date | null = null) => ({
    appId: APP,
    userId,
    state,
    productId,
    convertedAt,
  });
  await db.insert(schema.subscribers).values([
    sub("orig-1", "paid", "pro_monthly", at("2026-10-08")),
    sub("paid-2", "paid", "pro_weekly"),
    sub("trial-3", "trial", "pro_monthly"),
    sub("ref-6", "expired", "pro_monthly"),
  ]);

  const ai = (model: string, feature: string | null, costUsd: number | null) => ({
    appId: APP,
    id: crypto.randomUUID(),
    userId: "anon-1",
    ts: at("2026-10-05"),
    provider: model === "mystery" ? "x" : "openai",
    model,
    costUsd: costUsd === null ? null : String(costUsd),
    costSource: "table" as const,
    feature,
  });
  await db.insert(schema.aiEvents).values([ai("gpt-4o", "chat", 1), ai("gpt-4o", "summary", 2), ai("mystery", null, null)]);
});

describe("overview", () => {
  it("adds up cost and net revenue, resolving SDK ids through aliases", async () => {
    const o = await overview(db, APP, RANGE);
    expect(o.costUsd).toBeCloseTo(12.75);
    // 7 (orig-1) + 3.5 (paid-2) + 7 − 7 (ref-6); sandbox excluded
    expect(o.revenueUsd).toBeCloseTo(10.5);
    expect(o.costShare).toBeCloseTo(12.75 / 10.5);
    expect(o.marginUsd).toBeCloseTo(-2.25);
    expect(o.unmatchedCostUsd).toBeCloseTo(0.25);
    expect(o.usersWithCost).toBe(4);
    expect(o.matchRate).toBeCloseTo(0.75);
    expect(o.requests).toBe(6);
  });

  it("has one entry per day, dating refunds when they happen", async () => {
    const o = await overview(db, APP, RANGE);
    expect(o.daily).toHaveLength(16);
    const d = Object.fromEntries(o.daily.map((x) => [x.day, x]));
    expect(d["2026-10-02"]!.revenueUsd).toBeCloseTo(3.5);
    expect(d["2026-10-03"]).toMatchObject({ costUsd: 6, revenueUsd: 7 });
    expect(d["2026-10-06"]!.revenueUsd).toBeCloseTo(-7);
    expect(d["2026-10-01"]).toEqual({ day: "2026-10-01", costUsd: 0, revenueUsd: 0 });
  });

  it("counts sandbox revenue in test mode", async () => {
    const { eq } = await import("drizzle-orm");
    await db.update(schema.apps).set({ testMode: true }).where(eq(schema.apps.id, APP));
    expect((await overview(db, APP, RANGE)).revenueUsd).toBeCloseTo(80.5);
    await db.update(schema.apps).set({ testMode: false }).where(eq(schema.apps.id, APP));
  });
});

describe("plans", () => {
  it("groups by current product, worst margin first", async () => {
    const p = await plans(db, APP, RANGE);
    expect(p.map((x) => x.productId)).toEqual(["pro_weekly", "pro_monthly"]);
    expect(p[0]).toMatchObject({ users: 1, revenueUsd: 3.5, costUsd: 6, marginUsd: -2.5 });
    expect(p[1]).toMatchObject({ users: 3, revenueUsd: 7, costUsd: 6.5 });
  });
});

describe("users", () => {
  it("lists users by margin, worst first", async () => {
    const u = await users(db, APP, RANGE);
    expect(u[0]).toMatchObject({ userId: "paid-2", marginUsd: -2.5, state: "paid", productId: "pro_weekly" });
    expect(u.find((x) => x.userId === "free-4")).toMatchObject({ state: null, costUsd: 0.25 });
    expect(u.find((x) => x.userId === "orig-1")).toMatchObject({ costUsd: 6, revenueUsd: 7 });
    expect(u.some((x) => x.userId === "anon-1")).toBe(false);
  });

  it("filters to paying users losing money", async () => {
    const u = await users(db, APP, RANGE, { losingOnly: true });
    expect(u.map((x) => x.userId)).toEqual(["paid-2"]);
  });

  it("pages", async () => {
    const u = await users(db, APP, RANGE, { limit: 2, offset: 1 });
    expect(u).toHaveLength(2);
  });
});

describe("trialCohorts", () => {
  it("counts trial-period cost only and marks unfinished cohorts", async () => {
    const c = await trialCohorts(db, APP, { now: NOW });
    expect(c).toEqual([
      {
        week: "2026-10-12",
        trials: 1,
        converted: 0,
        conversionRate: 0,
        trialCostUsd: 0.5,
        costPerTrial: 0.5,
        costPerConvertedTrial: null,
        provisional: true,
      },
      {
        week: "2026-10-05",
        trials: 1,
        converted: 1,
        conversionRate: 1,
        // $1 + $2 during the trial; the $3 after conversion is excluded.
        trialCostUsd: 3,
        costPerTrial: 3,
        costPerConvertedTrial: 3,
        provisional: false,
      },
    ]);
  });
});

describe("breakdown", () => {
  it("sums cost by model and feature and counts unpriced requests", async () => {
    const b = await breakdown(db, APP, RANGE, NOW);
    expect(b.byModel).toEqual([
      { key: "openai/gpt-4o", provider: "openai", model: "gpt-4o", costUsd: 3, requests: 2, unpriced: 0 },
      { key: "x/mystery", provider: "x", model: "mystery", costUsd: 0, requests: 1, unpriced: 1 },
    ]);
    expect(b.byFeature.map((f) => [f.key, f.costUsd])).toEqual([
      ["summary", 2],
      ["chat", 1],
      ["", 0],
    ]);
  });

  it("clips the range to the 90 days of raw events", async () => {
    const b = await breakdown(db, APP, { from: "2026-01-01", to: "2026-10-17" }, NOW);
    expect(b.range.from).toBe("2026-07-19");
  });
});

describe("lastDays", () => {
  it("ends tomorrow so today is included", () => {
    expect(lastDays(30, NOW)).toEqual({ from: "2026-09-17", to: "2026-10-17" });
  });
});
