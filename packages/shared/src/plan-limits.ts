// Limits by plan: how much AI a free, trial or paying user may use in a day,
// a month or in total, and how much of it is left. The plan comes from the
// subscriber record (RevenueCat or Stripe) unless the caller names one.

import { eq, sql } from "drizzle-orm";
import { type Allowance, checkAllowance } from "./alerts";
import { monthStart, nextMonthStart } from "./limits";
import type { MetricsDb } from "./metrics";
import * as schema from "./schema";

export type PlanLimitRule = typeof schema.planLimits.$inferSelect;

/** Plan names with a meaning of their own; any other name is a product ID. */
export const PLAN_STATES = ["free", "trial", "paid"] as const;
export type PlanState = (typeof PLAN_STATES)[number];

export const PERIOD_LABELS: Record<schema.PlanPeriod, string> = {
  day: "a day",
  month: "a month",
  total: "in total",
};

export interface LimitStatus {
  period: schema.PlanPeriod;
  unit: "requests" | "usd";
  limit: number;
  used: number;
  /** Never below 0. */
  remaining: number;
  /** When the count starts again (UTC), or null for a total that never resets. */
  resetsAt: string | null;
}

export interface PlanAllowance extends Allowance {
  /** "free", "trial" or "paid" from the subscriber record, or the plan the caller named. */
  plan: string;
  /** The user's product in RevenueCat or Stripe, if they have one. */
  productId: string | null;
  /** The plan whose limits were applied; null when none match this user. */
  limitsFrom: string | null;
  /** One entry per limit that applies, with what is left of it. */
  limits: LimitStatus[];
}

type Row = Record<string, unknown>;
async function rows<T = Row>(db: MetricsDb, q: ReturnType<typeof sql>): Promise<T[]> {
  const res = (await db.execute(q)) as unknown;
  return (Array.isArray(res) ? res : (res as { rows: T[] }).rows) as T[];
}

// A renewal can be reported a little after the old period ends; a paying user
// must not drop to the free limits in between.
const RENEWAL_GRACE_MS = 24 * 60 * 60 * 1000;

/** The plan a subscriber record stands for; no record means a free user. */
export function planState(sub: { state: string; expiresAt: Date | null } | undefined, now = new Date()): PlanState {
  if (!sub || sub.state === "expired") return "free";
  if (sub.expiresAt && sub.expiresAt.getTime() + RENEWAL_GRACE_MS < now.getTime()) return "free";
  return sub.state === "trial" ? "trial" : "paid";
}

/**
 * Which plan's limits apply, most specific first: a trial user gets the
 * "trial" limits, else their product's, else "paid".
 */
export function planCandidates(state: PlanState, productId: string | null): string[] {
  if (state === "free") return ["free"];
  return [...(state === "trial" ? ["trial"] : []), ...(productId ? [productId] : []), "paid"];
}

const round = (n: number) => Math.round(n * 1e8) / 1e8;
const usd = (n: number) => `$${n.toFixed(n !== 0 && Math.abs(n) < 1 ? 4 : 2)}`;
const WHEN: Record<schema.PlanPeriod, string> = { day: "today", month: "this month", total: "in total" };

function describe(plan: string, l: LimitStatus): string {
  const amount = l.unit === "usd" ? `${usd(l.used)} of ${usd(l.limit)}` : `${l.used.toLocaleString("en-US")} of ${l.limit.toLocaleString("en-US")} AI calls`;
  return `${plan} plan limit reached (${amount} ${WHEN[l.period]})`;
}

interface Who {
  canonical: string;
  state: string | null;
  product_id: string | null;
  expires_at: string | Date | null;
  aliases: string[] | null;
}

/**
 * May this user make another AI call, and how much of their plan is left?
 * Refuses at a plan limit or at a budget marked "Block". `plan` overrides the
 * subscriber record, for apps that keep plans in their own database.
 */
export async function checkPlanAllowance(db: MetricsDb, appId: string, userId: string, plan?: string, now = new Date()): Promise<PlanAllowance> {
  // Sequential on purpose: Supabase's transaction pooler cannot pipeline.
  const rules = await db.select().from(schema.planLimits).where(eq(schema.planLimits.appId, appId));
  const [who] = await rows<Who>(
    db,
    sql`WITH c AS (
          SELECT coalesce((SELECT canonical_user_id FROM user_aliases WHERE app_id = ${appId}::uuid AND alias = ${userId}), ${userId}) AS id
        )
        SELECT c.id AS canonical, s.state, s.product_id, s.expires_at,
               (SELECT array_agg(alias) FROM user_aliases WHERE app_id = ${appId}::uuid AND canonical_user_id = c.id) AS aliases
        FROM c LEFT JOIN subscribers s ON s.app_id = ${appId}::uuid AND s.user_id = c.id`,
  );
  // Usage is stored under the ID each event was sent with.
  const ids = [...new Set([userId, who?.canonical ?? userId, ...(who?.aliases ?? [])])];
  const state = planState(who?.state ? { state: who.state, expiresAt: who.expires_at ? new Date(who.expires_at) : null } : undefined, now);
  const productId = state === "free" ? null : (who?.product_id ?? null);

  const candidates = plan ? [plan] : planCandidates(state, productId);
  const limitsFrom = candidates.find((name) => rules.some((r) => r.plan === name)) ?? null;
  const applied = rules.filter((r) => r.plan === limitsFrom);

  const budget = await checkAllowance(db, appId, ids, now);
  const out: PlanAllowance = { ...budget, plan: plan ?? state, productId, limitsFrom, limits: [] };
  if (applied.length === 0) return out;

  const today = now.toISOString().slice(0, 10);
  const month = monthStart(now);
  const idList = sql.join(
    ids.map((u) => sql`${u}`),
    sql`, `,
  );
  // Only a "total" limit needs the user's whole history.
  const since = applied.some((r) => r.period === "total") ? sql`` : sql`AND day >= ${month}::date`;
  const [u] = await rows<Record<string, string | null>>(
    db,
    sql`SELECT sum(requests) FILTER (WHERE day = ${today}::date) AS day_n, sum(cost_usd) FILTER (WHERE day = ${today}::date) AS day_usd,
               sum(requests) FILTER (WHERE day >= ${month}::date) AS month_n, sum(cost_usd) FILTER (WHERE day >= ${month}::date) AS month_usd,
               sum(requests) AS total_n, sum(cost_usd) AS total_usd
        FROM daily_user_cost WHERE app_id = ${appId}::uuid AND user_id IN (${idList}) ${since}`,
  );
  const resetsAt: Record<schema.PlanPeriod, string | null> = {
    day: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString(),
    month: `${nextMonthStart(now)}T00:00:00.000Z`,
    total: null,
  };
  for (const period of schema.PLAN_PERIODS) {
    const rule = applied.find((r) => r.period === period);
    if (!rule) continue;
    const add = (unit: LimitStatus["unit"], limit: number, used: number) =>
      out.limits.push({ period, unit, limit, used, remaining: Math.max(0, round(limit - used)), resetsAt: resetsAt[period] });
    if (rule.maxRequests !== null) add("requests", rule.maxRequests, Number(u?.[`${period}_n`] ?? 0));
    if (rule.maxCostUsd !== null) add("usd", Number(rule.maxCostUsd), round(Number(u?.[`${period}_usd`] ?? 0)));
  }
  const reached = out.limits.find((l) => l.remaining <= 0);
  // A budget marked "Block" already refused; keep its reason.
  if (reached && out.allow) return { ...out, allow: false, reason: describe(limitsFrom ?? out.plan, reached) };
  return out;
}

export interface LimitHit {
  userId: string;
  plan: PlanState;
  productId: string | null;
  /** The plan whose limit was reached. */
  limitsFrom: string;
  period: schema.PlanPeriod;
  unit: LimitStatus["unit"];
  used: number;
  limit: number;
}

/**
 * Users who are at a limit of their plan right now, heaviest first. On a free
 * plan these are the people most likely to upgrade.
 */
export async function usersAtLimit(db: MetricsDb, appId: string, now = new Date(), max = 200): Promise<LimitHit[]> {
  const rules = await db.select().from(schema.planLimits).where(eq(schema.planLimits.appId, appId));
  const from: Record<schema.PlanPeriod, string | null> = { day: now.toISOString().slice(0, 10), month: monthStart(now), total: null };
  const hits: LimitHit[] = [];
  for (const period of schema.PLAN_PERIODS) {
    const inPeriod = rules.filter((r) => r.period === period);
    if (inPeriod.length === 0) continue;
    // Nobody below the lowest limit of this period can have reached one.
    const lowest = (pick: (r: PlanLimitRule) => number | null) => {
      const ns = inPeriod.map(pick).filter((n): n is number => n !== null);
      return ns.length ? Math.min(...ns) : null;
    };
    const minCalls = lowest((r) => r.maxRequests);
    const minUsd = lowest((r) => (r.maxCostUsd === null ? null : Number(r.maxCostUsd)));
    const having = sql.join(
      [...(minCalls === null ? [] : [sql`sum(d.requests) >= ${minCalls}`]), ...(minUsd === null ? [] : [sql`sum(d.cost_usd) >= ${minUsd}`])],
      sql` OR `,
    );
    const since = from[period] === null ? sql`` : sql`AND d.day >= ${from[period]}::date`;
    const found = await rows<{ user_id: string; n: string; usd: string; state: string | null; product_id: string | null; expires_at: string | Date | null }>(
      db,
      sql`SELECT coalesce(a.canonical_user_id, d.user_id) AS user_id, sum(d.requests) AS n, sum(d.cost_usd) AS usd,
                 s.state, s.product_id, s.expires_at
          FROM daily_user_cost d
          LEFT JOIN user_aliases a ON a.app_id = d.app_id AND a.alias = d.user_id
          LEFT JOIN subscribers s ON s.app_id = d.app_id AND s.user_id = coalesce(a.canonical_user_id, d.user_id)
          WHERE d.app_id = ${appId}::uuid ${since}
          GROUP BY 1, s.state, s.product_id, s.expires_at
          HAVING ${having}
          ORDER BY sum(d.requests) DESC, 1
          LIMIT ${max}`,
    );
    for (const u of found) {
      const plan = planState(u.state ? { state: u.state, expiresAt: u.expires_at ? new Date(u.expires_at) : null } : undefined, now);
      const productId = plan === "free" ? null : u.product_id;
      const limitsFrom = planCandidates(plan, productId).find((name) => rules.some((r) => r.plan === name));
      const rule = inPeriod.find((r) => r.plan === limitsFrom);
      if (!rule || !limitsFrom) continue;
      const base = { userId: u.user_id, plan, productId, limitsFrom, period };
      const calls = Number(u.n);
      const cost = round(Number(u.usd));
      if (rule.maxRequests !== null && calls >= rule.maxRequests) hits.push({ ...base, unit: "requests", used: calls, limit: rule.maxRequests });
      else if (rule.maxCostUsd !== null && cost >= Number(rule.maxCostUsd)) hits.push({ ...base, unit: "usd", used: cost, limit: Number(rule.maxCostUsd) });
    }
  }
  return hits;
}
