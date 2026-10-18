import { PGlite } from "@electric-sql/pglite";
import { generateIngestKey, hashKey, MODEL_PRICES, schema } from "@fiscallm/shared";
import { lastDays, overview, users } from "@fiscallm/shared/metrics";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Hono } from "hono";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
// @ts-expect-error plain JavaScript example script, no type declarations
import { buildSample } from "../../../examples/send-sample-data.mjs";
import type { AnyDb } from "./ingest/db";
import { clearPriceCache } from "./ingest/prices";
import { eventsRoute } from "./ingest/route";
import { revenueRoute } from "./revenue/route";

// The example script must produce data the real API accepts, and the numbers
// must tell the story the example promises: one heavy user loses money.

let db: AnyDb;
let key: string;
let appId: string;

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: fileURLToPath(new URL("../../../packages/shared/drizzle", import.meta.url)) });
  db = pg as unknown as AnyDb;
  await db.insert(schema.modelPrices).values(
    MODEL_PRICES.map((p) => ({
      provider: p.provider,
      model: p.model,
      effectiveFrom: p.effectiveFrom,
      inputPerMtok: String(p.input),
      outputPerMtok: String(p.output),
      cachedPerMtok: p.cached === undefined ? null : String(p.cached),
      cacheWritePerMtok: p.cacheWrite === undefined ? null : String(p.cacheWrite),
      longContextThreshold: p.long?.threshold ?? null,
      longInputPerMtok: p.long?.input === undefined ? null : String(p.long.input),
      longOutputPerMtok: p.long?.output === undefined ? null : String(p.long.output),
      longCachedPerMtok: p.long?.cached === undefined ? null : String(p.long.cached),
      longCacheWritePerMtok: p.long?.cacheWrite === undefined ? null : String(p.long.cacheWrite),
      unitPrices: p.units ?? null,
    })),
  );
  clearPriceCache();
  key = generateIngestKey();
  const [app] = await db.insert(schema.apps).values({ name: "sample", ownerId: crypto.randomUUID(), ingestKeyHash: await hashKey(key), rcWebhookSecret: "x" }).returning();
  appId = app!.id;
});

const api = () => new Hono().route("/v1/events", eventsRoute(() => db)).route("/v1/revenue", revenueRoute(() => db));
const post = (path: string, events: unknown[]) =>
  api().request(path, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ events }) });

describe("examples/send-sample-data.mjs", () => {
  it("is accepted by the real API and shows one heavy user losing money", async () => {
    const { events, revenue } = buildSample() as { events: unknown[]; revenue: unknown[] };
    for (let i = 0; i < events.length; i += 100) {
      const res = await post("/v1/events", events.slice(i, i + 100));
      expect(res.status).toBe(202);
    }
    expect((await post("/v1/revenue", revenue)).status).toBe(202);

    const range = lastDays(30);
    const rows = await users(db as never, appId, range, { limit: 20 });
    const by = Object.fromEntries(rows.map((r) => [r.userId, r]));

    expect(Object.keys(by)).toEqual(expect.arrayContaining(["sample_light_1", "sample_heavy_1", "sample_free_1", "sample_trial_1"]));
    expect(by.sample_heavy_1!.marginUsd).toBeLessThan(0); // the point of the example
    expect(by.sample_light_1!.marginUsd).toBeGreaterThan(0);
    expect(by.sample_light_2!.marginUsd).toBeGreaterThan(0);
    expect(by.sample_free_1!.revenueUsd).toBe(0);

    const o = await overview(db as never, appId, range);
    expect(o.requests).toBe(events.length);
    expect(o.costUsd).toBeGreaterThan(0);
    expect(o.unmatchedCostUsd).toBeGreaterThan(0); // the free user
  }, 60_000);

  it("is repeatable", () => {
    const a = buildSample(1_800_000_000_000, 7) as { events: { userId: string; model: string; inputTokens: number }[] };
    const b = buildSample(1_800_000_000_000, 7) as typeof a;
    expect(a.events.map((e) => [e.userId, e.model, e.inputTokens])).toEqual(b.events.map((e) => [e.userId, e.model, e.inputTokens]));
  });
});
