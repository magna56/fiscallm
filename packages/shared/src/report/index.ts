// The Monday email: last week against the week before, the paying users
// and plans that lost money, and models without a price.

import { breakdown, type MetricsDb, overview, plans, type PlanRow, type Range, type UserRow, users } from "../metrics";

export interface WeeklyReport {
  range: Range;
  costUsd: number;
  revenueUsd: number;
  costShare: number | null;
  marginUsd: number;
  requests: number;
  previous: { costUsd: number; revenueUsd: number; marginUsd: number };
  losingUsers: UserRow[];
  losingPlans: PlanRow[];
  unpricedModels: string[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The last 7 whole UTC days before `now`, and the 7 before those. */
export function weekRanges(now: Date): { current: Range; previous: Range } {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = 86_400_000;
  return {
    current: { from: iso(new Date(today.getTime() - 7 * day)), to: iso(today) },
    previous: { from: iso(new Date(today.getTime() - 14 * day)), to: iso(new Date(today.getTime() - 7 * day)) },
  };
}

/** Null when the app had no AI cost and no revenue last week. */
export async function buildWeeklyReport(db: MetricsDb, appId: string, now = new Date()): Promise<WeeklyReport | null> {
  const { current, previous } = weekRanges(now);
  // One query at a time: Supabase's transaction pooler cannot pipeline.
  const o = await overview(db, appId, current);
  if (o.requests === 0 && o.revenueUsd === 0) return null;
  const p = await overview(db, appId, previous);
  const losingUsers = await users(db, appId, current, { losingOnly: true, limit: 5 });
  const losingPlans = (await plans(db, appId, current)).filter((x) => x.marginUsd < 0);
  const b = await breakdown(db, appId, current, now);
  return {
    range: current,
    costUsd: o.costUsd,
    revenueUsd: o.revenueUsd,
    costShare: o.costShare,
    marginUsd: o.marginUsd,
    requests: o.requests,
    previous: { costUsd: p.costUsd, revenueUsd: p.revenueUsd, marginUsd: p.marginUsd },
    losingUsers,
    losingPlans,
    unpricedModels: b.byModel.filter((m) => m.unpriced > 0).map((m) => m.key),
  };
}

const usd = (n: number) => {
  const digits = n !== 0 && Math.abs(n) < 1 ? 4 : 2;
  return `${n < 0 ? "−" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: digits })}`;
};
const pct = (n: number | null) => (n === null ? "–" : `${(n * 100).toFixed(1)}%`);
const change = (now: number, before: number) => {
  if (before === 0) return now === 0 ? "" : "new";
  const c = (now - before) / Math.abs(before);
  return `${c >= 0 ? "+" : "−"}${Math.abs(c * 100).toFixed(0)}% vs previous week`;
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export interface RenderOptions {
  appName: string;
  dashboardUrl: string;
  unsubscribeUrl: string;
}

export function renderWeeklyReport(r: WeeklyReport, o: RenderOptions) {
  const subject =
    r.marginUsd < 0
      ? `${o.appName}: AI cost exceeded revenue last week (${usd(r.marginUsd)})`
      : `${o.appName}: AI was ${pct(r.costShare)} of revenue last week`;

  const lines: string[] = [
    `${o.appName}, ${r.range.from} to ${r.range.to} (UTC)`,
    "",
    `AI cost: ${usd(r.costUsd)} (${change(r.costUsd, r.previous.costUsd)})`,
    `Net revenue: ${usd(r.revenueUsd)} (${change(r.revenueUsd, r.previous.revenueUsd)})`,
    `AI cost / revenue: ${pct(r.costShare)}`,
    `Margin after AI: ${usd(r.marginUsd)}`,
  ];
  if (r.losingUsers.length) {
    lines.push("", "Paying users who cost more than they paid:");
    for (const u of r.losingUsers) lines.push(`  ${u.userId} (${u.productId ?? "?"}): cost ${usd(u.costUsd)}, paid ${usd(u.revenueUsd)}`);
  }
  if (r.losingPlans.length) {
    lines.push("", "Plans with negative margin:");
    for (const p of r.losingPlans) lines.push(`  ${p.productId}: ${usd(p.marginUsd)} across ${p.users} users`);
  }
  if (r.unpricedModels.length) lines.push("", `Models without a price (cost counted as zero): ${r.unpricedModels.join(", ")}`);
  lines.push("", `Dashboard: ${o.dashboardUrl}`, "", `Stop these emails: ${o.unsubscribeUrl}`);

  const stat = (label: string, value: string, sub: string, color = "#111") =>
    `<td style="padding:12px;border:1px solid #eee;border-radius:8px;vertical-align:top">
      <div style="font-size:12px;color:#666">${label}</div>
      <div style="font-size:20px;font-weight:600;color:${color}">${value}</div>
      <div style="font-size:11px;color:#888">${esc(sub)}</div></td>`;
  const table = (head: string[], rows: string[][]) =>
    `<table cellpadding="6" style="border-collapse:collapse;width:100%;font-size:13px">
      <tr>${head.map((h, i) => `<th style="text-align:${i ? "right" : "left"};color:#666;font-weight:normal;border-bottom:1px solid #eee">${h}</th>`).join("")}</tr>
      ${rows.map((r) => `<tr>${r.map((c, i) => `<td style="text-align:${i ? "right" : "left"};border-bottom:1px solid #f3f3f3">${c}</td>`).join("")}</tr>`).join("")}
    </table>`;

  const html = `<!doctype html><html><body style="margin:0;background:#fafafa">
<div style="max-width:600px;margin:0 auto;padding:24px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;background:#fff">
  <div style="font-size:13px;color:#666">FiscaLLM weekly report</div>
  <h1 style="font-size:20px;margin:4px 0 16px">${esc(o.appName)}: ${r.range.from} to ${r.range.to}</h1>
  <table cellspacing="8" style="width:100%;margin:0 -8px"><tr>
    ${stat("AI cost", usd(r.costUsd), change(r.costUsd, r.previous.costUsd))}
    ${stat("Net revenue", usd(r.revenueUsd), change(r.revenueUsd, r.previous.revenueUsd))}
  </tr><tr>
    ${stat("AI cost / revenue", pct(r.costShare), "", r.costShare !== null && r.costShare > 0.3 ? "#dc2626" : "#111")}
    ${stat("Margin after AI", usd(r.marginUsd), change(r.marginUsd, r.previous.marginUsd), r.marginUsd < 0 ? "#dc2626" : "#16a34a")}
  </tr></table>
  ${
    r.losingUsers.length
      ? `<h2 style="font-size:15px;margin:24px 0 8px">Paying users who cost more than they paid</h2>
  ${table(["User", "Plan", "AI cost", "Paid", "Margin"], r.losingUsers.map((u) => [`<code>${esc(u.userId)}</code>`, esc(u.productId ?? ""), usd(u.costUsd), usd(u.revenueUsd), `<span style="color:#dc2626">${usd(u.marginUsd)}</span>`]))}`
      : `<p style="font-size:14px;color:#16a34a;margin-top:24px">No paying user cost more than they paid.</p>`
  }
  ${
    r.losingPlans.length
      ? `<h2 style="font-size:15px;margin:24px 0 8px">Plans with negative margin</h2>
  ${table(["Plan", "Users", "Revenue", "AI cost", "Margin"], r.losingPlans.map((p) => [esc(p.productId), String(p.users), usd(p.revenueUsd), usd(p.costUsd), `<span style="color:#dc2626">${usd(p.marginUsd)}</span>`]))}`
      : ""
  }
  ${
    r.unpricedModels.length
      ? `<p style="font-size:13px;color:#b45309;margin-top:20px">Models without a price, counted as zero: ${r.unpricedModels.map(esc).join(", ")}. Add a price in Settings.</p>`
      : ""
  }
  <p style="margin:28px 0"><a href="${esc(o.dashboardUrl)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:14px">Open the dashboard</a></p>
  <p style="font-size:11px;color:#999">Figures are estimates from list prices and RevenueCat data. <a href="${esc(o.unsubscribeUrl)}" style="color:#999">Stop these emails</a></p>
</div></body></html>`;

  return { subject, html, text: lines.join("\n") };
}
