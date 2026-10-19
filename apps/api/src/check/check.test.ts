import { PGlite } from "@electric-sql/pglite";
import { generateIngestKey, hashKey, schema } from "@fiscallm/shared";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Hono } from "hono";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "../ingest/db";
import { checkRoute, clearCheckCache } from "./route";

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
});
