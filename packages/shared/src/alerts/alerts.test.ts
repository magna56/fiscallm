import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MetricsDb } from "../metrics";
import * as schema from "../schema";
import { type AlertApp, checkAllowance, checkDaily, checkUserBudgets, deliverAlerts, describeAlert, isSlackWebhook, signWebhook } from "./index";

const NOW = new Date("2026-10-17T12:00:00Z");
let db: MetricsDb;
let app: AlertApp;

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  db = pg as unknown as MetricsDb;
});

beforeEach(async () => {
  await db.delete(schema.apps);
  const [a] = await db
    .insert(schema.apps)
    .values({ name: "Acme", ownerId: crypto.randomUUID(), ingestKeyHash: crypto.randomUUID(), rcWebhookSecret: "x", alertSecret: "whsec" })
    .returning();
  app = { id: a!.id, name: a!.name, ownerId: a!.ownerId, alertSecret: "whsec" };
  const cost = (userId: string, day: string, usd: number) => ({ appId: app.id, userId, day, costUsd: String(usd), requests: 1 });
  await db.insert(schema.dailyUserCost).values([cost("heavy", "2026-10-17", 6), cost("heavy", "2026-10-01", 20), cost("light", "2026-10-17", 0.5), cost("old", "2026-08-01", 99)]);
});

afterEach(() => vi.unstubAllGlobals());

const rule = async (kind: schema.AlertKind, threshold: number | null, extra: Partial<typeof schema.alertRules.$inferInsert> = {}) =>
  (await db.insert(schema.alertRules).values({ appId: app.id, kind, threshold: threshold === null ? null : String(threshold), ...extra }).returning())[0]!;

describe("checkUserBudgets", () => {
  it("flags users over today's and the 30-day budget", async () => {
    await rule("user_daily_cost", 5);
    await rule("user_30d_cost", 25);
    const alerts = await checkUserBudgets(db, app.id, ["heavy", "light", "old"], NOW);
    expect(alerts.map((a) => [a.rule.kind, a.subject, a.value])).toEqual([
      ["user_daily_cost", "heavy", 6],
      ["user_30d_cost", "heavy", 26],
    ]);
    expect(describeAlert(alerts[0]!)).toBe("User heavy spent $6.00 on AI today (budget $5.00).");
  });

  it("checks the app's spend today", async () => {
    await rule("app_daily_cost", 6);
    const [a] = await checkUserBudgets(db, app.id, ["light"], NOW);
    expect(a).toMatchObject({ subject: "app", value: 6.5 });
  });

  it("ignores disabled rules", async () => {
    await rule("user_daily_cost", 1, { enabled: false });
    expect(await checkUserBudgets(db, app.id, ["heavy"], NOW)).toEqual([]);
  });
});

describe("checkDaily", () => {
  it("flags losing users, a high cost share and unpriced models", async () => {
    await db.insert(schema.subscribers).values({ appId: app.id, userId: "heavy", state: "paid", productId: "pro" });
    await db.insert(schema.rcEvents).values({
      appId: app.id, id: "e1", type: "INITIAL_PURCHASE", appUserId: "heavy", originalAppUserId: "heavy",
      purchasedAt: new Date("2026-10-02T00:00:00Z"), eventTs: new Date("2026-10-02T00:00:00Z"), priceUsd: "10", netUsd: "7", environment: "PRODUCTION", raw: {},
    });
    await db.insert(schema.aiEvents).values({ appId: app.id, id: crypto.randomUUID(), userId: "light", ts: new Date("2026-10-17T10:00:00Z"), provider: "x", model: "mystery", costSource: "table" });
    await rule("user_losing", 10);
    await rule("app_cost_share", 0.5);
    await rule("unpriced_model", null);
    const alerts = await checkDaily(db, app.id, NOW);
    expect(alerts.map((a) => [a.rule.kind, a.subject])).toEqual([
      ["user_losing", "heavy"],
      ["unpriced_model", "x/mystery"],
    ]);
    // Revenue in the last 7 days is 0, so there is no share to compare.
    expect(alerts.find((a) => a.rule.kind === "user_losing")!.value).toBeCloseTo(-19);
  });
});

describe("deliverAlerts", () => {
  it("sends each alert once per day, emails a summary and signs webhooks", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await rule("user_daily_cost", 5, { webhookUrl: "https://example.com/hook" });
    const alerts = await checkUserBudgets(db, app.id, ["heavy"], NOW);

    // No owner email in this test database, so only the webhook goes out.
    const sent = await deliverAlerts(db, app, alerts, { resendApiKey: undefined, baseUrl: "https://fiscallm.com" });
    expect(sent).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://example.com/hook");
    const body = (init as RequestInit).body as string;
    expect(JSON.parse(body)).toMatchObject({ type: "alert.user_daily_cost", userId: "heavy", value: 6, threshold: 5 });
    const sig = (init as RequestInit & { headers: Record<string, string> }).headers["x-fiscallm-signature"]!;
    const t = Number(sig.match(/t=(\d+)/)![1]);
    expect(sig).toBe(await signWebhook("whsec", body, t));

    expect(await deliverAlerts(db, app, alerts, { resendApiKey: undefined, baseUrl: "x" })).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [row] = await db.select().from(schema.alertEvents);
    expect(row!.delivery).toEqual({ webhook: 200 });
  });
});

describe("user_burst (runaway loops)", () => {
  const ev = (userId: string, minutesAgo: number, tokens: number) => ({
    appId: app.id, id: crypto.randomUUID(), userId, ts: new Date(NOW.getTime() - minutesAgo * 60_000), provider: "openai", model: "gpt-5-mini",
    inputTokens: tokens, outputTokens: 0, costSource: "table" as const,
  });

  it("flags a user over the token limit inside the window, not older usage", async () => {
    await db.insert(schema.aiEvents).values([ev("looper", 1, 40_000), ev("looper", 3, 30_000), ev("slow", 2, 20_000), ev("slow", 30, 90_000)]);
    await rule("user_burst", 50_000);
    const alerts = await checkUserBudgets(db, app.id, ["looper", "slow"], NOW);
    expect(alerts.map((a) => [a.rule.kind, a.subject, a.value])).toEqual([["user_burst", "looper", 70_000]]);
    expect(describeAlert(alerts[0]!)).toContain("70,000 tokens in 5 minutes (limit 50,000)");
  });
});

describe("Slack", () => {
  it("recognises only Slack incoming-webhook URLs", () => {
    expect(isSlackWebhook("https://hooks.slack.com/services/T000/B000/XXXX")).toBe(true);
    expect(isSlackWebhook("http://hooks.slack.com/services/T000/B000/XXXX")).toBe(false);
    expect(isSlackWebhook("https://hooks.slack.com.evil.example/services/a")).toBe(false);
    expect(isSlackWebhook("https://example.com/services/a")).toBe(false);
    expect(isSlackWebhook("not a url")).toBe(false);
  });

  it("posts a Slack message, unsigned, even without an alert secret", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await rule("user_daily_cost", 5, { email: false, webhookUrl: "https://hooks.slack.com/services/T000/B000/XXXX" });
    const alerts = await checkUserBudgets(db, app.id, ["heavy"], NOW);
    expect(alerts[0]!.rule.id).toBe(r.id);
    await deliverAlerts(db, { ...app, alertSecret: null }, alerts, { resendApiKey: undefined, baseUrl: "https://fiscallm.com" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://hooks.slack.com/services/T000/B000/XXXX");
    const init2 = init as RequestInit & { headers: Record<string, string> };
    expect(init2.headers["x-fiscallm-signature"]).toBeUndefined();
    const body = JSON.parse(init2.body as string);
    expect(body.text).toContain("*Acme*: User heavy spent $6.00 on AI today");
    expect(body.text).toContain("<https://fiscallm.com/dashboard/");
    const [row] = await db.select().from(schema.alertEvents);
    expect(row!.delivery).toEqual({ slack: 200 });
  });
});

describe("checkAllowance (caps)", () => {
  it("allows everyone when no budget is enforced", async () => {
    await rule("user_daily_cost", 1);
    expect(await checkAllowance(db, app.id, "heavy", NOW)).toMatchObject({ allow: true, spentToday: 6, spent30d: 26, dailyLimit: null });
  });

  it("refuses a user at the enforced daily limit, and not other users", async () => {
    await rule("user_daily_cost", 5, { enforce: true });
    const heavy = await checkAllowance(db, app.id, "heavy", NOW);
    expect(heavy).toMatchObject({ allow: false, dailyLimit: 5 });
    expect(heavy.reason).toBe("daily AI budget reached ($6.00 of $5.00)");
    expect((await checkAllowance(db, app.id, "light", NOW)).allow).toBe(true);
    expect((await checkAllowance(db, app.id, "stranger", NOW))).toMatchObject({ allow: true, spentToday: 0, spent30d: 0 });
  });

  it("enforces the 30-day limit, uses the tightest rule, and ignores paused rules", async () => {
    await rule("user_30d_cost", 100, { enforce: true });
    await rule("user_30d_cost", 25, { enforce: true });
    expect(await checkAllowance(db, app.id, "heavy", NOW)).toMatchObject({ allow: false, monthlyLimit: 25 });
    await db.update(schema.alertRules).set({ enabled: false });
    expect((await checkAllowance(db, app.id, "heavy", NOW)).allow).toBe(true);
  });
});
