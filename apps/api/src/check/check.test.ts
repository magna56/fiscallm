import { PGlite } from "@electric-sql/pglite";
import { generateIngestKey, hashKey, schema } from "@fiscallm/shared";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Hono } from "hono";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "../ingest/db";
import { checkRoute, clearCheckCache, forgetChecks } from "./route";

const migrationsFolder = fileURLToPath(new URL("../../../../packages/shared/drizzle", import.meta.url));

let db: AnyDb;
let appId: string;
let key: string;
const api = () => new Hono().route("/v1/check", checkRoute(() => db));
const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder });
  db = pg as unknown as AnyDb;
});

beforeEach(async () => {
  clearCheckCache();
  await db.delete(schema.apps);
  key = generateIngestKey();
  const [app] = await db
    .insert(schema.apps)
    .values({ name: "test", ownerId: crypto.randomUUID(), ingestKeyHash: await hashKey(key), rcWebhookSecret: "x" })
    .returning();
  appId = app!.id;
  await db.insert(schema.dailyUserCost).values({ appId, userId: "heavy", day: today, costUsd: "6", requests: 3 });
});

const post = (body: unknown, auth: string | null = `Bearer ${key}`) =>
  api().request("/v1/check", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  });

describe("POST /v1/check", () => {
  it("rejects a missing or wrong key", async () => {
    expect((await post({ userId: "u" }, null)).status).toBe(401);
    expect((await post({ userId: "u" }, "Bearer fsk_nope")).status).toBe(401);
  });

  it("needs a userId", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ userId: "" })).status).toBe(400);
  });

  it("allows everyone when no budget is enforced", async () => {
    await db.insert(schema.alertRules).values({ appId, kind: "user_daily_cost", threshold: "1" });
    const res = await post({ userId: "heavy" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ allow: true, spentToday: 6 });
  });

  it("refuses a user over an enforced budget, with the reason", async () => {
    await db.insert(schema.alertRules).values({ appId, kind: "user_daily_cost", threshold: "5", enforce: true });
    expect(await (await post({ userId: "heavy" })).json()).toMatchObject({ allow: false, reason: "daily AI budget reached ($6.00 of $5.00)" });
    expect(await (await post({ userId: "someone-else" })).json()).toMatchObject({ allow: true });
  });

  it("keeps the answer for a few seconds, per user", async () => {
    const rule = (await db.insert(schema.alertRules).values({ appId, kind: "user_daily_cost", threshold: "5", enforce: true }).returning())[0]!;
    expect(((await (await post({ userId: "heavy" })).json()) as { allow: boolean }).allow).toBe(false);
    await db.delete(schema.alertRules).where((await import("drizzle-orm")).eq(schema.alertRules.id, rule.id));
    expect(((await (await post({ userId: "heavy" })).json()) as { allow: boolean }).allow).toBe(false); // cached
    clearCheckCache();
    expect(((await (await post({ userId: "heavy" })).json()) as { allow: boolean }).allow).toBe(true);
  });

  describe("limits by plan", () => {
    type Answer = { allow: boolean; reason?: string; plan: string; productId: string | null; limitsFrom: string | null; limits: Record<string, unknown>[] };
    const check = async (b: unknown) => (await (await post(b)).json()) as Answer;
    const limit = (plan: string, period: "day" | "month" | "total", maxRequests: number | null, maxCostUsd: string | null = null) =>
      db.insert(schema.planLimits).values({ appId, plan, period, maxRequests, maxCostUsd });
    const subscriber = (userId: string, state: "trial" | "paid" | "cancelled" | "expired", productId: string, expiresAt: Date | null = null) =>
      db.insert(schema.subscribers).values({ appId, userId, state, productId, expiresAt });

    it("reports the plan and no limits when none are set", async () => {
      expect(await check({ userId: "heavy" })).toMatchObject({ allow: true, plan: "free", productId: null, limitsFrom: null, limits: [] });
    });

    it("refuses a free user at the free limit and says what is left", async () => {
      await limit("free", "day", 3);
      const heavy = await check({ userId: "heavy" });
      expect(heavy).toMatchObject({ allow: false, plan: "free", limitsFrom: "free", reason: "free plan limit reached (3 of 3 AI calls today)" });
      expect(heavy.limits).toEqual([{ period: "day", unit: "requests", limit: 3, used: 3, remaining: 0, resetsAt: expect.stringMatching(/T00:00:00\.000Z$/) }]);
      const fresh = await check({ userId: "new-user" });
      expect(fresh).toMatchObject({ allow: true, plan: "free" });
      expect(fresh.limits[0]).toMatchObject({ used: 0, remaining: 3 });
    });

    it("gives a paying user their product's limits, else the paid ones", async () => {
      await limit("free", "day", 3);
      await limit("paid", "month", 100);
      await limit("pro_yearly", "month", null, "50");
      await subscriber("heavy", "paid", "pro_yearly");
      await subscriber("basic-user", "cancelled", "basic_monthly");
      const heavy = await check({ userId: "heavy" });
      expect(heavy).toMatchObject({ allow: true, plan: "paid", productId: "pro_yearly", limitsFrom: "pro_yearly" });
      expect(heavy.limits).toEqual([{ period: "month", unit: "usd", limit: 50, used: 6, remaining: 44, resetsAt: expect.any(String) }]);
      // Cancelled but not yet expired still has the plan.
      expect(await check({ userId: "basic-user" })).toMatchObject({ plan: "paid", productId: "basic_monthly", limitsFrom: "paid" });
    });

    it("treats a trial on its own, and an ended subscription as free", async () => {
      await limit("free", "total", 2);
      await limit("trial", "day", 10);
      await limit("paid", "day", 100);
      await subscriber("heavy", "trial", "pro_yearly");
      await subscriber("gone", "expired", "pro_yearly");
      await subscriber("lapsed", "paid", "pro_yearly", new Date(Date.now() - 3 * 86_400_000));
      await subscriber("renewing", "paid", "pro_yearly", new Date(Date.now() - 3_600_000));
      expect(await check({ userId: "heavy" })).toMatchObject({ allow: true, plan: "trial", limitsFrom: "trial" });
      expect(await check({ userId: "gone" })).toMatchObject({ plan: "free", productId: null, limitsFrom: "free" });
      expect(await check({ userId: "lapsed" })).toMatchObject({ plan: "free" });
      // A renewal reported an hour late does not drop a paying user to free.
      expect(await check({ userId: "renewing" })).toMatchObject({ plan: "paid", limitsFrom: "paid" });
    });

    it("counts a total that never resets across days", async () => {
      await limit("free", "total", 5);
      await db.insert(schema.dailyUserCost).values({ appId, userId: "heavy", day: "2025-01-02", costUsd: "1", requests: 2 });
      const heavy = await check({ userId: "heavy" });
      expect(heavy).toMatchObject({ allow: false, reason: "free plan limit reached (5 of 5 AI calls in total)" });
      expect(heavy.limits[0]).toMatchObject({ period: "total", used: 5, remaining: 0, resetsAt: null });
    });

    it("uses the plan the caller names instead of the subscriber record", async () => {
      await limit("free", "day", 1);
      await limit("team", "day", 50);
      expect(await check({ userId: "heavy", plan: "team" })).toMatchObject({ allow: true, plan: "team", limitsFrom: "team" });
      // A different plan for the same user is not answered from the cache.
      expect(await check({ userId: "heavy" })).toMatchObject({ allow: false, plan: "free" });
      expect(await check({ userId: "heavy", plan: "unknown" })).toMatchObject({ allow: true, plan: "unknown", limitsFrom: null, limits: [] });
    });

    it("adds up usage sent under an alias of the same user", async () => {
      await limit("paid", "day", 10);
      await subscriber("canonical", "paid", "pro");
      await db.insert(schema.userAliases).values({ appId, alias: "heavy", canonicalUserId: "canonical" });
      await db.insert(schema.dailyUserCost).values({ appId, userId: "canonical", day: today, costUsd: "1", requests: 4 });
      const viaAlias = await check({ userId: "heavy" });
      expect(viaAlias).toMatchObject({ plan: "paid", productId: "pro" });
      expect(viaAlias.limits[0]).toMatchObject({ used: 7, remaining: 3 });
      expect((await check({ userId: "canonical" })).limits[0]).toMatchObject({ used: 7 });
    });

    it("keeps the reason of a blocking budget when both refuse", async () => {
      await limit("free", "day", 1);
      await db.insert(schema.alertRules).values({ appId, kind: "user_daily_cost", threshold: "5", enforce: true });
      expect(await check({ userId: "heavy" })).toMatchObject({ allow: false, reason: "daily AI budget reached ($6.00 of $5.00)" });
    });

    it("counts new usage on the next check", async () => {
      await limit("free", "day", 5);
      expect((await check({ userId: "heavy" })).limits[0]).toMatchObject({ remaining: 2 });
      await db.update(schema.dailyUserCost).set({ requests: 4 });
      expect((await check({ userId: "heavy" })).limits[0]).toMatchObject({ remaining: 2 }); // cached
      forgetChecks(appId, ["heavy"]);
      expect((await check({ userId: "heavy" })).limits[0]).toMatchObject({ remaining: 1 });
    });
  });
});
