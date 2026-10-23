import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import { jobLoss, type MetricsDb } from "./index";

// "now" is 16 Oct noon UTC; jobs go stale after 60 minutes.
// j-ok     anon-1 (alias of orig-1): $0.40 + $0.10, captured.
// j-fail   orig-1: $0.30, refunded.
// j-limbo  orig-1: $0.80 at 09:00, pending since 09:00 (timed out, never reconciled).
// j-silent orig-1: $0.20 at 10:00, no outcome ever sent.
// j-new    u-2: $0.60 at 11:45, pending: still in progress.
// j-late   u-2: $0.50, refunded, then a late "pending" report that must not reopen it.
// (no job) u-2: $9 chat call, ignored.

const APP = "00000000-0000-4000-8000-000000000002";
const NOW = new Date("2026-10-16T12:00:00Z");
const RANGE = { from: "2026-10-01", to: "2026-10-17" };

let db: MetricsDb;

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  db = pg as unknown as MetricsDb;
  await db.insert(schema.apps).values({ id: APP, name: "t", ownerId: APP, ingestKeyHash: "h2", rcWebhookSecret: "s" });
  await db.insert(schema.userAliases).values({ appId: APP, alias: "anon-1", canonicalUserId: "orig-1" });

  const ev = (userId: string, jobId: string | null, at: string, costUsd: string | null) => ({
    appId: APP, id: crypto.randomUUID(), userId, ts: new Date(at), provider: "fal", model: "video",
    costUsd, costSource: "client" as const, jobId,
  });
  await db.insert(schema.aiEvents).values([
    ev("anon-1", "j-ok", "2026-10-15T10:00:00Z", "0.4"),
    ev("anon-1", "j-ok", "2026-10-15T10:01:00Z", "0.1"),
    ev("orig-1", "j-fail", "2026-10-15T11:00:00Z", "0.3"),
    ev("orig-1", "j-limbo", "2026-10-16T09:00:00Z", "0.8"),
    ev("orig-1", "j-silent", "2026-10-16T10:00:00Z", "0.2"),
    ev("orig-1", "j-silent", "2026-10-16T10:00:00Z", null),
    ev("u-2", "j-new", "2026-10-16T11:45:00Z", "0.6"),
    ev("u-2", "j-late", "2026-10-14T08:00:00Z", "0.5"),
    ev("u-2", null, "2026-10-14T08:00:00Z", "9"),
  ]);
  const job = (jobId: string, userId: string, status: schema.JobStatus, at: string) => ({ appId: APP, jobId, userId, status, statusAt: new Date(at) });
  await db.insert(schema.jobs).values([
    job("j-ok", "anon-1", "captured", "2026-10-15T10:02:00Z"),
    job("j-fail", "orig-1", "refunded", "2026-10-15T11:05:00Z"),
    job("j-limbo", "orig-1", "pending", "2026-10-16T09:00:00Z"),
    job("j-new", "u-2", "pending", "2026-10-16T11:45:00Z"),
    job("j-late", "u-2", "refunded", "2026-10-14T08:10:00Z"),
  ]);
});

describe("jobLoss", () => {
  it("splits job cost by what happened to the payment", async () => {
    const r = await jobLoss(db, APP, RANGE, { now: NOW });
    expect(r.totals.captured).toEqual({ jobs: 1, costUsd: 0.5 });
    expect(r.totals.refunded).toEqual({ jobs: 2, costUsd: 0.8 });
    expect(r.totals.unresolved).toEqual({ jobs: 2, costUsd: 1 });
    expect(r.totals.inProgress).toEqual({ jobs: 1, costUsd: 0.6 });
    expect(r.unpriced).toBe(1);
  });

  it("lists users by cost they were not charged for, aliases merged", async () => {
    const r = await jobLoss(db, APP, RANGE, { now: NOW });
    expect(r.users).toEqual([
      { userId: "orig-1", refundedCostUsd: 0.3, refundedJobs: 1, unresolvedCostUsd: 1, unresolvedJobs: 2 },
      { userId: "u-2", refundedCostUsd: 0.5, refundedJobs: 1, unresolvedCostUsd: 0, unresolvedJobs: 0 },
    ]);
  });

  it("treats a recent pending job as in progress until it goes stale", async () => {
    const later = new Date("2026-10-16T13:00:00Z");
    const r = await jobLoss(db, APP, RANGE, { now: later });
    expect(r.totals.inProgress.jobs).toBe(0);
    expect(r.totals.unresolved).toEqual({ jobs: 3, costUsd: 1.6 });
  });
});
