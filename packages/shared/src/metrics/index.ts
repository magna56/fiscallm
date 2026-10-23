// Every metric in BUILD-PLAN.md section 9, in one place, so the dashboard
// and the weekly email report the same numbers. Plain SQL over the event
// tables; only this module needs to change if they move to another store.

import { sql, type SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "../schema";

export type MetricsDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Whole UTC days: `from` inclusive, `to` exclusive, as YYYY-MM-DD. */
export interface Range {
  from: string;
  to: string;
}

export function lastDays(days: number, now = new Date()): Range {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const from = new Date(to.getTime() - days * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const RAW_RETENTION_DAYS = 90;

type Row = Record<string, unknown>;

// postgres-js returns an array, PGlite returns { rows }.
async function query<T = Row>(db: MetricsDb, q: SQL): Promise<T[]> {
  const res = (await db.execute(q)) as unknown;
  return (Array.isArray(res) ? res : (res as { rows: T[] }).rows) as T[];
}

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const day = (v: unknown) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
const ratio = (a: number, b: number) => (b === 0 ? null : a / b);

/**
 * AI cost per canonical user and day. The SDK's user id is resolved
 * through the RevenueCat alias map; unknown ids stand for themselves.
 */
const costCte = (appId: string, r: Range) => sql`
  cost AS (
    SELECT coalesce(a.canonical_user_id, d.user_id) AS uid, d.day, d.cost_usd, d.requests
    FROM daily_user_cost d
    LEFT JOIN user_aliases a ON a.app_id = d.app_id AND a.alias = d.user_id
    WHERE d.app_id = ${appId}::uuid AND d.day >= ${r.from}::date AND d.day < ${r.to}::date
  )`;

/**
 * Net revenue per canonical user and day. Purchases are dated by purchase
 * time, refunds by when they happened. Sandbox counts only in test mode.
 */
const revenueCte = (appId: string, r: Range) => sql`
  rev AS (
    SELECT coalesce(a.canonical_user_id, e.original_app_user_id, e.app_user_id) AS uid,
           (CASE WHEN e.type = 'CANCELLATION' THEN e.event_ts
                 ELSE coalesce(e.purchased_at, e.event_ts) END AT TIME ZONE 'UTC')::date AS day,
           e.net_usd
    FROM rc_events e
    JOIN apps ap ON ap.id = e.app_id
    LEFT JOIN user_aliases a
      ON a.app_id = e.app_id AND a.alias = coalesce(e.original_app_user_id, e.app_user_id)
    WHERE e.app_id = ${appId}::uuid
      AND e.net_usd IS NOT NULL
      AND (e.type IN ('INITIAL_PURCHASE', 'RENEWAL', 'NON_RENEWING_PURCHASE', 'REFUND_REVERSED')
           OR (e.type = 'CANCELLATION' AND e.price_usd < 0))
      AND (ap.test_mode OR e.environment IS DISTINCT FROM 'SANDBOX')
  ),
  rev_in AS (
    SELECT * FROM rev WHERE day >= ${r.from}::date AND day < ${r.to}::date
  )`;

/** Cost and revenue per user over the range, with their subscription. */
const userStatsCte = (appId: string, r: Range) => sql`
  ${costCte(appId, r)},
  ${revenueCte(appId, r)},
  user_cost AS (SELECT uid, sum(cost_usd) AS cost, sum(requests) AS requests FROM cost GROUP BY uid),
  user_rev AS (SELECT uid, sum(net_usd) AS revenue FROM rev_in GROUP BY uid),
  stats AS (
    SELECT coalesce(c.uid, v.uid) AS uid,
           coalesce(c.cost, 0) AS cost,
           coalesce(c.requests, 0) AS requests,
           coalesce(v.revenue, 0) AS revenue,
           s.state, s.product_id, (s.user_id IS NOT NULL) AS matched
    FROM user_cost c
    FULL JOIN user_rev v ON v.uid = c.uid
    LEFT JOIN subscribers s ON s.app_id = ${appId}::uuid AND s.user_id = coalesce(c.uid, v.uid)
  )`;

export interface Overview {
  costUsd: number;
  revenueUsd: number;
  /** AI cost ÷ net revenue, as a fraction; null without revenue. */
  costShare: number | null;
  marginUsd: number;
  requests: number;
  /** Cost of users with no RevenueCat record: free users, or a broken join. */
  unmatchedCostUsd: number;
  /** Of users with AI cost, the share RevenueCat knows; null without users. */
  matchRate: number | null;
  usersWithCost: number;
  daily: { day: string; costUsd: number; revenueUsd: number }[];
}

export async function overview(db: MetricsDb, appId: string, r: Range): Promise<Overview> {
  const [t] = await query(
    db,
    sql`WITH ${userStatsCte(appId, r)}
      SELECT sum(cost) AS cost, sum(revenue) AS revenue, sum(requests) AS requests,
             sum(cost) FILTER (WHERE NOT matched) AS unmatched_cost,
             count(*) FILTER (WHERE cost > 0 OR requests > 0) AS users_with_cost,
             count(*) FILTER (WHERE (cost > 0 OR requests > 0) AND matched) AS matched_users
      FROM stats`,
  );
  const daily = await query(
    db,
    sql`WITH ${costCte(appId, r)}, ${revenueCte(appId, r)}
      SELECT g.day::date AS day,
             coalesce((SELECT sum(cost_usd) FROM cost WHERE cost.day = g.day::date), 0) AS cost,
             coalesce((SELECT sum(net_usd) FROM rev_in WHERE rev_in.day = g.day::date), 0) AS revenue
      FROM generate_series(${r.from}::date, ${r.to}::date - 1, interval '1 day') AS g(day)
      ORDER BY 1`,
  );
  const cost = num(t?.cost);
  const revenue = num(t?.revenue);
  const users = num(t?.users_with_cost);
  return {
    costUsd: cost,
    revenueUsd: revenue,
    costShare: revenue > 0 ? cost / revenue : null,
    marginUsd: revenue - cost,
    requests: num(t?.requests),
    unmatchedCostUsd: num(t?.unmatched_cost),
    matchRate: ratio(num(t?.matched_users), users),
    usersWithCost: users,
    daily: daily.map((d) => ({ day: day(d.day), costUsd: num(d.cost), revenueUsd: num(d.revenue) })),
  };
}

export interface PlanRow {
  productId: string;
  users: number;
  revenueUsd: number;
  costUsd: number;
  marginUsd: number;
  costShare: number | null;
}

/** One row per product. A user's cost counts toward their current plan. */
export async function plans(db: MetricsDb, appId: string, r: Range): Promise<PlanRow[]> {
  const rows = await query(
    db,
    sql`WITH ${userStatsCte(appId, r)}
      SELECT product_id, count(*) AS users, sum(revenue) AS revenue, sum(cost) AS cost
      FROM stats WHERE matched AND product_id IS NOT NULL
      GROUP BY product_id
      ORDER BY sum(revenue) - sum(cost)`,
  );
  return rows.map((x) => {
    const revenue = num(x.revenue);
    const cost = num(x.cost);
    return {
      productId: String(x.product_id),
      users: num(x.users),
      revenueUsd: revenue,
      costUsd: cost,
      marginUsd: revenue - cost,
      costShare: revenue > 0 ? cost / revenue : null,
    };
  });
}

export interface UserRow {
  userId: string;
  state: string | null;
  productId: string | null;
  costUsd: number;
  revenueUsd: number;
  marginUsd: number;
  requests: number;
}

export interface UsersOptions {
  /** Only paying users (paid or cancelled but active) losing money. */
  losingOnly?: boolean;
  limit?: number;
  offset?: number;
}

/** Users by margin, worst first. */
export async function users(
  db: MetricsDb,
  appId: string,
  r: Range,
  opts: UsersOptions = {},
): Promise<UserRow[]> {
  const losing = opts.losingOnly
    ? sql`WHERE state IN ('paid', 'cancelled') AND revenue - cost < 0`
    : sql``;
  const rows = await query(
    db,
    sql`WITH ${userStatsCte(appId, r)}
      SELECT uid, state, product_id, cost, revenue, requests
      FROM stats ${losing}
      ORDER BY revenue - cost, uid
      LIMIT ${opts.limit ?? 50} OFFSET ${opts.offset ?? 0}`,
  );
  return rows.map((x) => ({
    userId: String(x.uid),
    state: (x.state as string | null) ?? null,
    productId: (x.product_id as string | null) ?? null,
    costUsd: num(x.cost),
    revenueUsd: num(x.revenue),
    marginUsd: num(x.revenue) - num(x.cost),
    requests: num(x.requests),
  }));
}

export interface TrialCohort {
  /** Monday of the week the trials started, YYYY-MM-DD. */
  week: string;
  trials: number;
  converted: number;
  conversionRate: number | null;
  /** AI cost incurred during the trial periods only. */
  trialCostUsd: number;
  costPerTrial: number | null;
  costPerConvertedTrial: number | null;
  /** Some trials in the cohort have not ended yet. */
  provisional: boolean;
}

/** Trial cohorts by start week, newest first. */
export async function trialCohorts(
  db: MetricsDb,
  appId: string,
  opts: { weeks?: number; now?: Date } = {},
): Promise<TrialCohort[]> {
  const now = (opts.now ?? new Date()).toISOString();
  const weeks = opts.weeks ?? 12;
  const rows = await query(
    db,
    sql`WITH trial_events AS (
        SELECT coalesce(a.canonical_user_id, e.original_app_user_id, e.app_user_id) AS uid,
               coalesce(e.purchased_at, e.event_ts) AS started, e.expiration_at AS ends
        FROM rc_events e
        JOIN apps ap ON ap.id = e.app_id
        LEFT JOIN user_aliases a
          ON a.app_id = e.app_id AND a.alias = coalesce(e.original_app_user_id, e.app_user_id)
        WHERE e.app_id = ${appId}::uuid AND e.type = 'INITIAL_PURCHASE' AND e.period_type = 'TRIAL'
          AND (ap.test_mode OR e.environment IS DISTINCT FROM 'SANDBOX')
      ),
      trials AS (
        SELECT DISTINCT ON (t.uid) t.uid, t.started, t.ends, s.converted_at,
               coalesce(s.converted_at, t.ends) AS trial_end
        FROM trial_events t
        LEFT JOIN subscribers s ON s.app_id = ${appId}::uuid AND s.user_id = t.uid
        WHERE t.started >= ${now}::timestamptz - make_interval(weeks => ${weeks})
        ORDER BY t.uid, t.started
      ),
      resolved AS (
        SELECT coalesce(a.canonical_user_id, d.user_id) AS uid, d.day, d.cost_usd
        FROM daily_user_cost d
        LEFT JOIN user_aliases a ON a.app_id = d.app_id AND a.alias = d.user_id
        WHERE d.app_id = ${appId}::uuid
      ),
      trial_cost AS (
        SELECT t.uid, coalesce(sum(r.cost_usd), 0) AS cost
        FROM trials t
        LEFT JOIN resolved r
          ON r.uid = t.uid
         AND r.day >= (t.started AT TIME ZONE 'UTC')::date
         AND (t.trial_end IS NULL OR r.day < (t.trial_end AT TIME ZONE 'UTC')::date)
        GROUP BY t.uid
      )
      SELECT date_trunc('week', t.started AT TIME ZONE 'UTC')::date AS week,
             count(*) AS trials,
             count(t.converted_at) AS converted,
             sum(c.cost) AS cost,
             bool_or(t.converted_at IS NULL AND (t.ends IS NULL OR t.ends > ${now}::timestamptz)) AS provisional
      FROM trials t JOIN trial_cost c ON c.uid = t.uid
      GROUP BY 1 ORDER BY 1 DESC`,
  );
  return rows.map((x) => {
    const trials = num(x.trials);
    const converted = num(x.converted);
    const cost = num(x.cost);
    return {
      week: day(x.week),
      trials,
      converted,
      conversionRate: ratio(converted, trials),
      trialCostUsd: cost,
      costPerTrial: ratio(cost, trials),
      costPerConvertedTrial: ratio(cost, converted),
      provisional: Boolean(x.provisional),
    };
  });
}

export interface BreakdownRow {
  key: string;
  costUsd: number;
  requests: number;
  /** Requests with no price; their cost is missing from costUsd. */
  unpriced: number;
}

export interface Breakdown {
  /** The range actually used: raw events are kept 90 days. */
  range: Range;
  byModel: (BreakdownRow & { provider: string; model: string })[];
  byFeature: BreakdownRow[];
}

export async function breakdown(
  db: MetricsDb,
  appId: string,
  r: Range,
  now = new Date(),
): Promise<Breakdown> {
  const oldest = lastDays(RAW_RETENTION_DAYS, now).from;
  const range = { from: r.from < oldest ? oldest : r.from, to: r.to };
  const where = sql`app_id = ${appId}::uuid AND ts >= ${range.from}::date AND ts < ${range.to}::date`;
  const totals = sql`sum(cost_usd) AS cost, count(*) AS requests, count(*) FILTER (WHERE cost_usd IS NULL) AS unpriced`;

  const models = await query(
    db,
    sql`SELECT provider, model, ${totals} FROM ai_events WHERE ${where}
        GROUP BY provider, model ORDER BY sum(cost_usd) DESC NULLS LAST, count(*) DESC`,
  );
  const features = await query(
    db,
    sql`SELECT coalesce(feature, '') AS feature, ${totals} FROM ai_events WHERE ${where}
        GROUP BY 1 ORDER BY sum(cost_usd) DESC NULLS LAST, count(*) DESC`,
  );
  const row = (x: Row) => ({ costUsd: num(x.cost), requests: num(x.requests), unpriced: num(x.unpriced) });
  return {
    range,
    byModel: models.map((x) => ({
      key: `${x.provider}/${x.model}`,
      provider: String(x.provider),
      model: String(x.model),
      ...row(x),
    })),
    byFeature: features.map((x) => ({ key: String(x.feature), ...row(x) })),
  };
}


export type JobOutcomeKind = "captured" | "refunded" | "unresolved" | "inProgress";

export interface JobTotals {
  jobs: number;
  costUsd: number;
}

export interface JobLossUser {
  userId: string;
  /** AI cost of jobs whose payment was given back. */
  refundedCostUsd: number;
  refundedJobs: number;
  /** AI cost of jobs never captured or refunded, past `staleAfterMinutes`. */
  unresolvedCostUsd: number;
  unresolvedJobs: number;
}

export interface JobLoss {
  /** The range actually used: raw events are kept 90 days. */
  range: Range;
  totals: Record<JobOutcomeKind, JobTotals>;
  /** Users with refunded or unresolved job cost, most lost first. */
  users: JobLossUser[];
  /** Job events with no price; their cost is missing from the totals. */
  unpriced: number;
}

/**
 * AI cost per job, split by what happened to the user's payment. Only events
 * sent with a jobId count. A job with no final status (pending, or never
 * reported) is "in progress" until nothing has happened on it for
 * `staleAfterMinutes`, then "unresolved": you may have paid the provider for
 * it without charging the user. Its cost is already in the user's margin;
 * this shows how much of it bought nothing the user paid for.
 */
export async function jobLoss(
  db: MetricsDb,
  appId: string,
  r: Range,
  opts: { now?: Date; staleAfterMinutes?: number; limit?: number } = {},
): Promise<JobLoss> {
  const now = opts.now ?? new Date();
  const oldest = lastDays(RAW_RETENTION_DAYS, now).from;
  const range = { from: r.from < oldest ? oldest : r.from, to: r.to };
  const stale = new Date(now.getTime() - (opts.staleAfterMinutes ?? 60) * 60_000).toISOString();
  const jobsCte = sql`
    job_cost AS (
      SELECT e.job_id, min(e.user_id) AS user_id, sum(e.cost_usd) AS cost, max(e.ts) AS last_ts,
             count(*) FILTER (WHERE e.cost_usd IS NULL) AS unpriced
      FROM ai_events e
      WHERE e.app_id = ${appId}::uuid AND e.job_id IS NOT NULL
        AND e.ts >= ${range.from}::date AND e.ts < ${range.to}::date
      GROUP BY e.job_id
    ),
    job AS (
      SELECT coalesce(a.canonical_user_id, j.user_id, c.user_id) AS uid, c.cost, c.unpriced,
             CASE WHEN j.status IN ('captured', 'refunded') THEN j.status
                  WHEN greatest(c.last_ts, j.status_at) < ${stale}::timestamptz THEN 'unresolved'
                  ELSE 'inProgress' END AS outcome
      FROM job_cost c
      LEFT JOIN jobs j ON j.app_id = ${appId}::uuid AND j.job_id = c.job_id
      LEFT JOIN user_aliases a ON a.app_id = ${appId}::uuid AND a.alias = coalesce(j.user_id, c.user_id)
    )`;
  const totals = await query(
    db,
    sql`WITH ${jobsCte}
      SELECT outcome, count(*) AS jobs, sum(cost) AS cost, sum(unpriced) AS unpriced FROM job GROUP BY outcome`,
  );
  const rows = await query(
    db,
    sql`WITH ${jobsCte}
      SELECT uid,
             sum(cost) FILTER (WHERE outcome = 'refunded') AS refunded_cost,
             count(*) FILTER (WHERE outcome = 'refunded') AS refunded_jobs,
             sum(cost) FILTER (WHERE outcome = 'unresolved') AS unresolved_cost,
             count(*) FILTER (WHERE outcome = 'unresolved') AS unresolved_jobs
      FROM job WHERE outcome IN ('refunded', 'unresolved')
      GROUP BY uid
      ORDER BY coalesce(sum(cost), 0) DESC, uid
      LIMIT ${opts.limit ?? 50}`,
  );
  const empty = (): JobTotals => ({ jobs: 0, costUsd: 0 });
  const out: Record<JobOutcomeKind, JobTotals> = { captured: empty(), refunded: empty(), unresolved: empty(), inProgress: empty() };
  let unpriced = 0;
  for (const t of totals) {
    out[t.outcome as JobOutcomeKind] = { jobs: num(t.jobs), costUsd: num(t.cost) };
    unpriced += num(t.unpriced);
  }
  return {
    range,
    totals: out,
    unpriced,
    users: rows.map((x) => ({
      userId: String(x.uid),
      refundedCostUsd: num(x.refunded_cost),
      refundedJobs: num(x.refunded_jobs),
      unresolvedCostUsd: num(x.unresolved_cost),
      unresolvedJobs: num(x.unresolved_jobs),
    })),
  };
}
