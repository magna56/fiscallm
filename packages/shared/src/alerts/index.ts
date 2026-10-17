// Budgets and alerts. Per-user cost rules are checked as events arrive;
// app-wide rules once a day. Each rule fires once per subject per day.

import { and, eq, inArray, sql } from "drizzle-orm";
import { breakdown, lastDays, type MetricsDb, overview, users } from "../metrics";
import { ownerEmail } from "../report/send";
import * as schema from "../schema";

export type AlertRule = typeof schema.alertRules.$inferSelect;

export interface Alert {
  rule: AlertRule;
  subject: string;
  period: string;
  value: number;
  threshold: number | null;
}

export interface AlertApp {
  id: string;
  name: string;
  ownerId: string;
  alertSecret: string | null;
}

export interface DeliverConfig {
  resendApiKey: string | undefined;
  baseUrl: string;
}

type Row = Record<string, unknown>;
async function rows<T = Row>(db: MetricsDb, q: ReturnType<typeof sql>): Promise<T[]> {
  const res = (await db.execute(q)) as unknown;
  return (Array.isArray(res) ? res : (res as { rows: T[] }).rows) as T[];
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const usd = (n: number) => `$${n.toFixed(n !== 0 && Math.abs(n) < 1 ? 4 : 2)}`;

export const ALERT_LABELS: Record<schema.AlertKind, string> = {
  user_daily_cost: "A user's AI cost today is over",
  user_30d_cost: "A user's AI cost in 30 days is over",
  user_losing: "A paying user's loss in 30 days is over",
  app_cost_share: "AI cost in 7 days is over this share of revenue",
  app_daily_cost: "The app's AI cost today is over",
  unpriced_model: "A model without a price is used",
};

export function describeAlert(a: Alert): string {
  const t = a.threshold ?? 0;
  switch (a.rule.kind) {
    case "user_daily_cost":
      return `User ${a.subject} spent ${usd(a.value)} on AI today (budget ${usd(t)}).`;
    case "user_30d_cost":
      return `User ${a.subject} spent ${usd(a.value)} on AI in the last 30 days (budget ${usd(t)}).`;
    case "user_losing":
      return `Paying user ${a.subject} cost ${usd(-a.value)} more than they paid in the last 30 days (limit ${usd(t)}).`;
    case "app_cost_share":
      return `AI cost was ${(a.value * 100).toFixed(1)}% of revenue in the last 7 days (limit ${(t * 100).toFixed(0)}%).`;
    case "app_daily_cost":
      return `The app spent ${usd(a.value)} on AI today (budget ${usd(t)}).`;
    case "unpriced_model":
      return `Model ${a.subject} was used but has no price, so its cost counts as zero.`;
  }
}

async function enabledRules(db: MetricsDb, appId: string, kinds: schema.AlertKind[]) {
  const r = schema.alertRules;
  return db
    .select()
    .from(r)
    .where(and(eq(r.appId, appId), eq(r.enabled, true), inArray(r.kind, kinds)));
}

const threshold = (rule: AlertRule) => (rule.threshold === null ? null : Number(rule.threshold));

/** Per-user budgets for the users in a fresh batch of events. */
export async function checkUserBudgets(db: MetricsDb, appId: string, userIds: string[], now = new Date()): Promise<Alert[]> {
  const rules = await enabledRules(db, appId, ["user_daily_cost", "user_30d_cost", "app_daily_cost"]);
  if (rules.length === 0 || userIds.length === 0) return [];
  const today = day(now);
  const from30 = lastDays(30, now).from;
  const alerts: Alert[] = [];
  const ids = sql.join(
    userIds.map((u) => sql`${u}`),
    sql`, `,
  );

  for (const rule of rules) {
    const t = threshold(rule);
    if (t === null) continue;
    if (rule.kind === "app_daily_cost") {
      const [r] = await rows<{ cost: string | null }>(db, sql`SELECT sum(cost_usd) AS cost FROM daily_user_cost WHERE app_id = ${appId}::uuid AND day = ${today}::date`);
      const cost = Number(r?.cost ?? 0);
      if (cost > t) alerts.push({ rule, subject: "app", period: today, value: cost, threshold: t });
      continue;
    }
    const since = rule.kind === "user_daily_cost" ? today : from30;
    const over = await rows<{ user_id: string; cost: string }>(
      db,
      sql`SELECT user_id, sum(cost_usd) AS cost FROM daily_user_cost
          WHERE app_id = ${appId}::uuid AND user_id IN (${ids}) AND day >= ${since}::date
          GROUP BY user_id HAVING sum(cost_usd) > ${t}`,
    );
    for (const o of over) alerts.push({ rule, subject: o.user_id, period: today, value: Number(o.cost), threshold: t });
  }
  return alerts;
}

/** App-wide rules, run once a day. */
export async function checkDaily(db: MetricsDb, appId: string, now = new Date()): Promise<Alert[]> {
  const rules = await enabledRules(db, appId, ["user_losing", "app_cost_share", "unpriced_model"]);
  const today = day(now);
  const alerts: Alert[] = [];
  for (const rule of rules) {
    const t = threshold(rule);
    if (rule.kind === "user_losing" && t !== null) {
      const losing = await users(db, appId, lastDays(30, now), { losingOnly: true, limit: 50 });
      for (const u of losing) if (-u.marginUsd > t) alerts.push({ rule, subject: u.userId, period: today, value: u.marginUsd, threshold: t });
    } else if (rule.kind === "app_cost_share" && t !== null) {
      const o = await overview(db, appId, lastDays(7, now));
      if (o.costShare !== null && o.costShare > t) alerts.push({ rule, subject: "app", period: today, value: o.costShare, threshold: t });
    } else if (rule.kind === "unpriced_model") {
      const b = await breakdown(db, appId, lastDays(1, now), now);
      for (const m of b.byModel) if (m.unpriced > 0) alerts.push({ rule, subject: m.key, period: today, value: m.unpriced, threshold: null });
    }
  }
  return alerts;
}

// ---- delivery ----

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** `t=<unix>,v1=<hmac-sha256 hex of "t.body">`, like Stripe and RevenueCat. */
export async function signWebhook(secret: string, body: string, t = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`));
  return `t=${t},v1=${hex(sig)}`;
}

export function webhookPayload(app: AlertApp, a: Alert) {
  return {
    type: `alert.${a.rule.kind}`,
    appId: app.id,
    ruleId: a.rule.id,
    subject: a.subject,
    userId: a.subject === "app" || a.rule.kind === "unpriced_model" ? null : a.subject,
    value: a.value,
    threshold: a.threshold,
    period: a.period,
    message: describeAlert(a),
  };
}

/**
 * Records new alerts (skipping ones already sent today), then emails the
 * owner one summary and calls each rule's webhook.
 */
export async function deliverAlerts(db: MetricsDb, app: AlertApp, alerts: Alert[], config: DeliverConfig): Promise<Alert[]> {
  const fresh: { alert: Alert; id: string }[] = [];
  for (const a of alerts) {
    const [row] = await db
      .insert(schema.alertEvents)
      .values({ ruleId: a.rule.id, appId: app.id, subject: a.subject, period: a.period, payload: webhookPayload(app, a) })
      .onConflictDoNothing()
      .returning({ id: schema.alertEvents.id });
    if (row) fresh.push({ alert: a, id: row.id });
  }
  if (fresh.length === 0) return [];

  const delivery = new Map<string, Record<string, unknown>>();
  const emailed = fresh.filter((f) => f.alert.rule.email);
  if (emailed.length && config.resendApiKey) {
    const to = await ownerEmail(db, app.ownerId);
    if (to) {
      const lines = emailed.map((f) => describeAlert(f.alert));
      const subject = emailed.length === 1 ? `${app.name}: ${lines[0]}` : `${app.name}: ${emailed.length} FiscaLLM alerts`;
      const url = `${config.baseUrl}/dashboard/${app.id}`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${config.resendApiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM_ALERTS ?? "FiscaLLM <alerts@fiscallm.com>",
          to: [to],
          subject: subject.slice(0, 200),
          text: `${lines.join("\n")}\n\nDashboard: ${url}\nChange alerts: ${url}/settings#alerts`,
          html: `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111"><p><strong>${app.name.replace(/</g, "&lt;")}</strong></p><ul>${lines
            .map((l) => `<li>${l.replace(/</g, "&lt;")}</li>`)
            .join("")}</ul><p><a href="${url}">Open the dashboard</a> · <a href="${url}/settings#alerts">Change alerts</a></p></div>`,
        }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null);
      for (const f of emailed) delivery.set(f.id, { email: res?.ok ? "sent" : `failed ${res?.status ?? "network"}` });
    }
  }

  for (const f of fresh) {
    const url = f.alert.rule.webhookUrl;
    if (!url || !app.alertSecret) continue;
    const body = JSON.stringify(webhookPayload(app, f.alert));
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-fiscallm-signature": await signWebhook(app.alertSecret, body), "user-agent": "FiscaLLM-Alerts/1" },
      body,
      signal: AbortSignal.timeout(5_000),
    }).catch(() => null);
    delivery.set(f.id, { ...delivery.get(f.id), webhook: res ? res.status : "network error" });
  }

  for (const [id, d] of delivery) {
    await db.update(schema.alertEvents).set({ delivery: d }).where(eq(schema.alertEvents.id, id));
  }
  return fresh.map((f) => f.alert);
}
