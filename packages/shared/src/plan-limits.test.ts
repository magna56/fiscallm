import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { MetricsDb } from "./metrics";
import { checkPlanAllowance, planCandidates, planState, usersAtLimit } from "./plan-limits";
import * as schema from "./schema";

const NOW = new Date("2026-10-17T12:00:00Z");
let db: MetricsDb;
let appId: string;

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  db = pg as unknown as MetricsDb;
});

beforeEach(async () => {
  await db.delete(schema.apps);
  const [a] = await db.insert(schema.apps).values({ name: "Acme", ownerId: crypto.randomUUID(), ingestKeyHash: crypto.randomUUID(), rcWebhookSecret: "x" }).returning();
  appId = a!.id;
  const use = (userId: string, day: string, requests: number, usd: number) => ({ appId, userId, day, costUsd: String(usd), requests });
  await db.insert(schema.dailyUserCost).values([
    use("free-heavy", "2026-10-17", 20, 0.2),
    use("free-light", "2026-10-17", 3, 0.03),
    use("pro", "2026-10-17", 40, 2),
    use("pro", "2026-10-03", 300, 9),
    use("pro", "2026-09-20", 500, 30),
    use("anon-1", "2026-10-17", 15, 0.1),
  ]);
  await db.insert(schema.subscribers).values({ appId, userId: "pro", state: "paid", productId: "pro_monthly" });
  await db.insert(schema.userAliases).values({ appId, alias: "anon-1", canonicalUserId: "free-heavy" });
});

const limit = (plan: string, period: schema.PlanPeriod, maxRequests: number | null, maxCostUsd: number | null = null) =>
  db.insert(schema.planLimits).values({ appId, plan, period, maxRequests, maxCostUsd: maxCostUsd === null ? null : String(maxCostUsd) });

describe("planState and planCandidates", () => {
  it("maps subscriber records to plans", () => {
    expect(planState(undefined, NOW)).toBe("free");
    expect(planState({ state: "expired", expiresAt: null }, NOW)).toBe("free");
    expect(planState({ state: "trial", expiresAt: null }, NOW)).toBe("trial");
    expect(planState({ state: "cancelled", expiresAt: new Date("2026-11-01T00:00:00Z") }, NOW)).toBe("paid");
    expect(planState({ state: "paid", expiresAt: new Date("2026-10-17T00:00:00Z") }, NOW)).toBe("paid"); // within a day of renewal
    expect(planState({ state: "paid", expiresAt: new Date("2026-10-10T00:00:00Z") }, NOW)).toBe("free");
  });

  it("orders the plans whose limits may apply", () => {
    expect(planCandidates("free", null)).toEqual(["free"]);
    expect(planCandidates("trial", "pro")).toEqual(["trial", "pro", "paid"]);
    expect(planCandidates("paid", "pro")).toEqual(["pro", "paid"]);
    expect(planCandidates("paid", null)).toEqual(["paid"]);
  });
});

describe("checkPlanAllowance", () => {
  it("reports each period's use against the plan, with reset times", async () => {
    await limit("paid", "day", 100, 5);
    await limit("paid", "month", 1000);
    await limit("paid", "total", null, 50);
    const a = await checkPlanAllowance(db, appId, "pro", undefined, NOW);
    expect(a).toMatchObject({ allow: true, plan: "paid", productId: "pro_monthly", limitsFrom: "paid" });
    expect(a.limits).toEqual([
      { period: "day", unit: "requests", limit: 100, used: 40, remaining: 60, resetsAt: "2026-10-18T00:00:00.000Z" },
      { period: "day", unit: "usd", limit: 5, used: 2, remaining: 3, resetsAt: "2026-10-18T00:00:00.000Z" },
      { period: "month", unit: "requests", limit: 1000, used: 340, remaining: 660, resetsAt: "2026-11-01T00:00:00.000Z" },
      { period: "total", unit: "usd", limit: 50, used: 41, remaining: 9, resetsAt: null },
    ]);
  });

  it("refuses at the first limit reached, and a limit of 0 always", async () => {
    await limit("paid", "month", 340);
    await limit("free", "day", 0);
    expect(await checkPlanAllowance(db, appId, "pro", undefined, NOW)).toMatchObject({ allow: false, reason: "paid plan limit reached (340 of 340 AI calls this month)" });
    expect(await checkPlanAllowance(db, appId, "nobody", undefined, NOW)).toMatchObject({ allow: false, reason: "free plan limit reached (0 of 0 AI calls today)" });
  });

  it("names a dollar limit in dollars", async () => {
    await limit("free", "day", null, 0.25);
    expect((await checkPlanAllowance(db, appId, "free-heavy", undefined, NOW)).reason).toBe("free plan limit reached ($0.3000 of $0.2500 today)");
  });
});

describe("usersAtLimit", () => {
  it("lists who is at a limit, with aliases counted as one user", async () => {
    await limit("free", "day", 20);
    await limit("pro_monthly", "month", null, 10);
    const hits = await usersAtLimit(db, appId, NOW);
    expect(hits).toEqual([
      { userId: "free-heavy", plan: "free", productId: null, limitsFrom: "free", period: "day", unit: "requests", used: 35, limit: 20 },
      { userId: "pro", plan: "paid", productId: "pro_monthly", limitsFrom: "pro_monthly", period: "month", unit: "usd", used: 11, limit: 10 },
    ]);
  });

  it("is empty with no limits set", async () => {
    expect(await usersAtLimit(db, appId, NOW)).toEqual([]);
  });
});
