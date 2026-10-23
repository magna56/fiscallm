import { PGlite } from "@electric-sql/pglite";
import { generateIngestKey, hashKey, schema } from "@fiscallm/shared";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Hono } from "hono";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "../ingest/db";
import { jobsRoute } from "./route";

const migrationsFolder = fileURLToPath(new URL("../../../../packages/shared/drizzle", import.meta.url));

let db: AnyDb;
let appId: string;
let key: string;
const api = () => new Hono().route("/v1/jobs", jobsRoute(() => db));

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder });
  db = pg as unknown as AnyDb;
});

beforeEach(async () => {
  await db.delete(schema.apps);
  key = generateIngestKey();
  const [app] = await db
    .insert(schema.apps)
    .values({ name: "test", ownerId: crypto.randomUUID(), ingestKeyHash: await hashKey(key), rcWebhookSecret: "x" })
    .returning();
  appId = app!.id;
});

const post = (jobs: unknown, auth: string | null = `Bearer ${key}`) =>
  api().request("/v1/jobs", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify({ jobs }),
  });

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const status = async (jobId: string) =>
  (await db.select().from(schema.jobs).where(and(eq(schema.jobs.appId, appId), eq(schema.jobs.jobId, jobId))))[0]?.status;

describe("POST /v1/jobs", () => {
  it("rejects a missing key and bad input", async () => {
    expect((await post([{ jobId: "j", userId: "u", status: "captured" }], null)).status).toBe(401);
    expect((await post([{ jobId: "j", userId: "u", status: "lost" }])).status).toBe(400);
    expect((await post([])).status).toBe(400);
  });

  it("moves a job from pending to its final status", async () => {
    expect((await post([{ jobId: "j1", userId: "u", status: "pending", ts: ago(10) }])).status).toBe(202);
    expect(await status("j1")).toBe("pending");
    await post([{ jobId: "j1", userId: "u", status: "refunded", ts: ago(5) }]);
    expect(await status("j1")).toBe("refunded");
  });

  it("ignores older reports and late pendings", async () => {
    await post([{ jobId: "j2", userId: "u", status: "captured", ts: ago(5) }]);
    const res = await post([{ jobId: "j2", userId: "u", status: "refunded", ts: ago(10) }]);
    expect(await res.json()).toEqual({ accepted: 0, ignored: 1 });
    await post([{ jobId: "j2", userId: "u", status: "pending" }]);
    expect(await status("j2")).toBe("captured");
  });

  it("lets a newer final status win, e.g. a refund after reconciling", async () => {
    await post([{ jobId: "j3", userId: "u", status: "captured", ts: ago(10) }]);
    await post([{ jobId: "j3", userId: "u", status: "refunded", ts: ago(1) }]);
    expect(await status("j3")).toBe("refunded");
  });

  it("keeps the newest of duplicates within one batch", async () => {
    await post([
      { jobId: "j4", userId: "u", status: "refunded", ts: ago(1) },
      { jobId: "j4", userId: "u", status: "pending", ts: ago(9) },
    ]);
    expect(await status("j4")).toBe("refunded");
  });
});
