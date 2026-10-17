import { PGlite } from "@electric-sql/pglite";
import { generateIngestKey, hashKey, schema } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "../ingest/db";
import { revenueRoute } from "./route";

let db: AnyDb;
let appId: string;
let key: string;
const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: fileURLToPath(new URL("../../../../packages/shared/drizzle", import.meta.url)) });
  db = pg as unknown as AnyDb;
});

beforeEach(async () => {
  await db.delete(schema.apps);
  key = generateIngestKey();
  const [app] = await db.insert(schema.apps).values({ name: "t", ownerId: crypto.randomUUID(), ingestKeyHash: await hashKey(key), rcWebhookSecret: "x" }).returning();
  appId = app!.id;
});

const post = (events: unknown[], auth = `Bearer ${key}`) =>
  revenueRoute(() => db).request("/", { method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify({ events }) });
const subscriber = async (u: string) => (await db.select().from(schema.subscribers).where(eq(schema.subscribers.userId, u)))[0];

describe("POST /v1/revenue", () => {
  it("needs a valid ingest key", async () => {
    expect((await post([], "")).status).toBe(401);
    expect((await post([], "Bearer fsk_nope")).status).toBe(401);
  });

  it("follows a trial, conversion and refund like RevenueCat events", async () => {
    let res = await post([
      { id: "t1", userId: "u1", type: "trial_started", productId: "pro", ts: ago(20), periodEnd: ago(13) },
      { id: "p1", userId: "u1", type: "renewal", productId: "pro", amountUsd: 10, feePct: 0.15, taxPct: 0.1, isTrialConversion: true, ts: ago(13), periodEnd: new Date(Date.now() + 17 * DAY).toISOString() },
    ]);
    expect(await res.json()).toEqual({ accepted: 2, duplicates: 0 });
    let s = await subscriber("u1");
    expect(s).toMatchObject({ state: "paid", productId: "pro" });
    expect(Number(s!.netRevenueUsd)).toBeCloseTo(7.5);
    expect(s!.convertedAt).not.toBeNull();

    res = await post([{ id: "r1", userId: "u1", type: "refund", productId: "pro", amountUsd: 10, netUsd: 7.5, ts: ago(1) }]);
    s = await subscriber("u1");
    expect(s!.state).toBe("expired");
    expect(Number(s!.netRevenueUsd)).toBeCloseTo(0);
  });

  it("takes net revenue directly, and one-time purchases", async () => {
    await post([{ id: "life", userId: "u2", type: "purchase", oneTime: true, productId: "lifetime", amountUsd: 50, netUsd: 41, ts: ago(2) }]);
    const s = await subscriber("u2");
    expect(s).toMatchObject({ state: "paid", productId: "lifetime", expiresAt: null });
    expect(Number(s!.netRevenueUsd)).toBe(41);
  });

  it("ignores retries of the same id", async () => {
    const e = { id: "p9", userId: "u3", type: "purchase", amountUsd: 5, ts: ago(1), periodEnd: new Date(Date.now() + DAY).toISOString() };
    await post([e]);
    expect(await (await post([e])).json()).toEqual({ accepted: 0, duplicates: 1 });
    expect(Number((await subscriber("u3"))!.netRevenueUsd)).toBe(5);
  });

  it("joins a user already known under a RevenueCat alias", async () => {
    await db.insert(schema.userAliases).values({ appId, alias: "anon-1", canonicalUserId: "orig-1" });
    await post([{ id: "p2", userId: "anon-1", type: "purchase", amountUsd: 5, ts: ago(1), periodEnd: new Date(Date.now() + DAY).toISOString() }]);
    expect(await subscriber("anon-1")).toBeUndefined();
    expect(Number((await subscriber("orig-1"))!.netRevenueUsd)).toBe(5);
  });

  it("rejects money events without an amount", async () => {
    const res = await post([{ id: "x", userId: "u", type: "purchase", ts: ago(1) }]);
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).toContain("amountUsd");
  });
});
