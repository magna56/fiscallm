import { hashKey, schema } from "@fiscallm/shared";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AnyDb } from "../ingest/db";

const DAY_MS = 86_400_000;

const jobSchema = z.object({
  // The same id sent as `jobId` on the job's AI events.
  jobId: z.string().min(1).max(128),
  userId: z.string().min(1).max(256),
  // pending: payment held, outcome unknown (e.g. the provider timed out).
  // captured: the user was charged. refunded: the user got it back.
  status: z.enum(schema.JOB_STATUSES),
  ts: z.iso
    .datetime({ offset: true })
    .transform((s) => new Date(s))
    .refine((d) => d.getTime() <= Date.now() + 3_600_000, "ts is in the future")
    .refine((d) => d.getTime() >= Date.now() - 90 * DAY_MS, "ts is older than 90 days")
    .optional(),
});

export const jobBatchSchema = z.object({ jobs: z.array(jobSchema).min(1).max(100) });
export type JobOutcome = z.output<typeof jobSchema>;

/** POST /api/v1/jobs: what happened to the user's payment for each job. */
export function jobsRoute(getDb: () => AnyDb) {
  return new Hono().post("/", async (c) => {
    const key = c.req.header("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!key) return c.json({ error: "missing ingest key" }, 401);
    const db = getDb();
    const [app] = await db
      .select({ id: schema.apps.id })
      .from(schema.apps)
      .where(eq(schema.apps.ingestKeyHash, await hashKey(key)))
      .limit(1);
    if (!app) return c.json({ error: "invalid ingest key" }, 401);

    const parsed = jobBatchSchema.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) {
      const issues = parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message }));
      return c.json({ error: "invalid jobs", issues }, 400);
    }
    return c.json(await storeJobs(db, app.id, parsed.data.jobs), 202);
  });
}

/**
 * Upserts job outcomes. A report applies only if it is at least as new as the
 * stored one, so retries and out-of-order deliveries settle on the latest
 * status. "pending" never replaces a final status: a late "still held" report
 * must not reopen a job that was already captured or refunded.
 */
export async function storeJobs(db: AnyDb, appId: string, jobs: JobOutcome[]) {
  const now = new Date();
  // One row per job id in the batch; the newest report wins.
  const latest = new Map<string, JobOutcome & { ts: Date }>();
  for (const j of jobs) {
    const ts = j.ts ?? now;
    const prev = latest.get(j.jobId);
    if (!prev || ts >= prev.ts) latest.set(j.jobId, { ...j, ts });
  }
  const t = schema.jobs;
  const applied = await db
    .insert(t)
    .values([...latest.values()].map((j) => ({ appId, jobId: j.jobId, userId: j.userId, status: j.status, statusAt: j.ts })))
    .onConflictDoUpdate({
      target: [t.appId, t.jobId],
      set: { userId: sql`excluded.user_id`, status: sql`excluded.status`, statusAt: sql`excluded.status_at` },
      setWhere: sql`excluded.status_at >= ${t.statusAt} AND NOT (excluded.status = 'pending' AND ${t.status} <> 'pending')`,
    })
    .returning({ jobId: t.jobId });
  return { accepted: applied.length, ignored: jobs.length - applied.length };
}
