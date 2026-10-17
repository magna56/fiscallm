import { PGlite } from "@electric-sql/pglite";
import { generateIngestKey, hashKey, MODEL_PRICES, schema } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Hono } from "hono";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "./db";
import { clearUsageCache } from "./limit";
import { clearPriceCache } from "./prices";
import { eventsRoute } from "./route";

const migrationsFolder = fileURLToPath(new URL("../../../../packages/shared/drizzle", import.meta.url));

let db: AnyDb;
let appId: string;
let key: string;
const api = () => new Hono().route("/v1/events", eventsRoute(() => db));

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder });
  db = pg as unknown as AnyDb;
  await db.insert(schema.modelPrices).values(
    MODEL_PRICES.filter((p) => p.model === "gpt-4o").map((p) => ({
      provider: p.provider,
      model: p.model,
      effectiveFrom: p.effectiveFrom,
      inputPerMtok: String(p.input),
      outputPerMtok: String(p.output),
      cachedPerMtok: String(p.cached),
    })),
  );
});

beforeEach(async () => {
  clearPriceCache();
  clearUsageCache();
  delete process.env.MONTHLY_EVENT_CAP;
  await db.delete(schema.apps);
  key = generateIngestKey();
  const [app] = await db
    .insert(schema.apps)
    .values({
      name: "test",
      ownerId: crypto.randomUUID(),
      ingestKeyHash: await hashKey(key),
      rcWebhookSecret: "x",
    })
    .returning();
  appId = app!.id;
});

const now = () => new Date().toISOString();
const event = (over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  userId: "user-1",
  ts: now(),
  provider: "openai",
  model: "gpt-4o-2024-08-06",
  inputTokens: 1_000_000,
  outputTokens: 100_000,
  ...over,
});

function post(body: unknown, auth = `Bearer ${key}`) {
  return api().request("/v1/events", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: auth },
    body: JSON.stringify(body),
  });
}

const daily = () => db.select().from(schema.dailyUserCost).where(eq(schema.dailyUserCost.appId, appId));

describe("POST /v1/events", () => {
  it("rejects a missing or wrong key", async () => {
    expect((await post({ events: [event()] }, "")).status).toBe(401);
    expect((await post({ events: [event()] }, "Bearer fsk_nope")).status).toBe(401);
  });

  it("stores and prices events and rolls them up per user and day", async () => {
    const res = await post({ events: [event(), event(), event({ userId: "user-2" })] });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ accepted: 3, duplicates: 0, unpriced: 0 });

    const rows = await db.select().from(schema.aiEvents);
    expect(rows).toHaveLength(3);
    // 1M input at $2.50 + 100k output at $10
    expect(Number(rows[0]!.costUsd)).toBe(3.5);
    expect(rows[0]!.costSource).toBe("table");

    const d = await daily();
    const u1 = d.find((r) => r.userId === "user-1")!;
    expect(Number(u1.costUsd)).toBe(7);
    expect(u1.requests).toBe(2);
  });

  it("does not double count retried events", async () => {
    const e = event();
    await post({ events: [e] });
    const res = await post({ events: [e, event()] });
    expect(await res.json()).toEqual({ accepted: 1, duplicates: 1, unpriced: 0 });
    const [d] = await daily();
    expect(Number(d!.costUsd)).toBe(7);
    expect(d!.requests).toBe(2);
  });

  it("stores unknown models as unpriced and still counts the request", async () => {
    const res = await post({ events: [event({ model: "mystery-1" })] });
    expect(await res.json()).toEqual({ accepted: 1, duplicates: 0, unpriced: 1 });
    const [row] = await db.select().from(schema.aiEvents);
    expect(row!.costUsd).toBeNull();
    const [d] = await daily();
    expect(d!.requests).toBe(1);
  });

  it("uses a client cost when given", async () => {
    await post({ events: [event({ provider: "fal", model: "flux", inputTokens: 0, outputTokens: 0, costUsd: 0.04 })] });
    const [row] = await db.select().from(schema.aiEvents);
    expect(row!.costSource).toBe("client");
    expect(Number(row!.costUsd)).toBe(0.04);
  });

  it("prices units such as minutes of audio", async () => {
    await db.insert(schema.modelPrices).values({ provider: "openai", model: "whisper-1", effectiveFrom: "2024-01-01", inputPerMtok: "0", outputPerMtok: "0", unitPrices: { minute: 0.006 } });
    const res = await post({ events: [event({ model: "whisper-1", inputTokens: 0, outputTokens: 0, units: 12.5, unit: "minute" })] });
    expect(await res.json()).toEqual({ accepted: 1, duplicates: 0, unpriced: 0 });
    const [row] = await db.select().from(schema.aiEvents);
    expect(Number(row!.costUsd)).toBeCloseTo(0.075);
    expect(row).toMatchObject({ unit: "minute", units: "12.500000" });
    expect((await post({ events: [event({ units: 3 })] })).status).toBe(400);
  });

  it("applies the app's price override", async () => {
    await db.insert(schema.appPriceOverrides).values({
      appId,
      provider: "openai",
      model: "*",
      effectiveFrom: "2024-01-01",
      discountPct: "20",
    });
    await post({ events: [event()] });
    const [row] = await db.select().from(schema.aiEvents);
    expect(Number(row!.costUsd)).toBe(2.8);
    expect(row!.costSource).toBe("override");
  });

  it("rejects invalid batches and says why", async () => {
    const res = await post({ events: [event({ id: "not-a-uuid", inputTokens: -1 })] });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { issues: { path: string }[] };
    expect(body.issues.map((i) => i.path)).toEqual(["events.0.id", "events.0.inputTokens"]);

    expect((await post({ events: [] })).status).toBe(400);
    expect((await post({ events: Array.from({ length: 101 }, () => event()) })).status).toBe(400);
    expect((await post({ events: [event({ ts: "2020-01-01T00:00:00Z" })] })).status).toBe(400);
    expect(await db.select().from(schema.aiEvents)).toHaveLength(0);
  });
});

describe("monthly event cap", () => {
  it("is off by default", async () => {
    expect((await post({ events: [event()] })).status).toBe(202);
  });

  it("accepts events under the cap, then refuses with a clear message once it is reached", async () => {
    process.env.MONTHLY_EVENT_CAP = "3";
    expect((await post({ events: [event(), event()] })).status).toBe(202);
    expect((await post({ events: [event()] })).status).toBe(202);
    // 3 of 3 used: the next batch is refused and nothing is stored.
    const res = await post({ events: [event()] });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; limit: number; used: number; resetsAt: string };
    expect(body.limit).toBe(3);
    expect(body.used).toBe(3);
    expect(body.error).toContain("monthly event limit");
    expect(body.resetsAt).toMatch(/^\d{4}-\d{2}-01$/);
    const total = (await daily()).reduce((n, r) => n + r.requests, 0);
    expect(total).toBe(3);
  });

  it("counts apps separately", async () => {
    process.env.MONTHLY_EVENT_CAP = "1";
    expect((await post({ events: [event()] })).status).toBe(202);
    expect((await post({ events: [event()] })).status).toBe(403);
    // another app is unaffected
    const otherKey = generateIngestKey();
    await db.insert(schema.apps).values({ name: "other", ownerId: crypto.randomUUID(), ingestKeyHash: await hashKey(otherKey), rcWebhookSecret: "y" });
    expect((await post({ events: [event()] }, `Bearer ${otherKey}`)).status).toBe(202);
  });
});

