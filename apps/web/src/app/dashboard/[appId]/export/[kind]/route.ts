import { toCsv } from "@fiscallm/shared/csv";
import { plans, trialCohorts, users } from "@fiscallm/shared/metrics";
import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireApp } from "@/lib/auth";
import { metricsDb } from "@/lib/db";
import { rangeFrom } from "@/lib/range";

const MAX_ROWS = 10_000;

/** CSV download of the Users, Plans or Trials table, for the signed-in owner. */
export async function GET(request: NextRequest, ctx: RouteContext<"/dashboard/[appId]/export/[kind]">) {
  const { appId, kind } = await ctx.params;
  const app = await requireApp(appId);
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const { days, range } = rangeFrom(sp);
  const db = metricsDb();

  let csv: string;
  if (kind === "users") {
    const rows = await users(db, app.id, range, { losingOnly: sp.losing === "1", limit: MAX_ROWS });
    csv = toCsv(
      ["user_id", "status", "plan", "requests", "ai_cost_usd", "net_revenue_usd", "margin_usd"],
      rows.map((r) => [r.userId, r.state ?? "free_or_unmatched", r.productId, r.requests, r.costUsd, r.revenueUsd, r.marginUsd]),
    );
  } else if (kind === "plans") {
    const rows = await plans(db, app.id, range);
    csv = toCsv(
      ["plan", "users", "net_revenue_usd", "ai_cost_usd", "margin_usd", "ai_cost_share_of_revenue"],
      rows.map((r) => [r.productId, r.users, r.revenueUsd, r.costUsd, r.marginUsd, r.costShare]),
    );
  } else if (kind === "trials") {
    const rows = await trialCohorts(db, app.id, { weeks: 12 });
    csv = toCsv(
      ["week_of", "trials", "converted", "conversion_rate", "ai_cost_in_trial_usd", "cost_per_trial_usd", "cost_per_converted_trial_usd", "in_progress"],
      rows.map((r) => [r.week, r.trials, r.converted, r.conversionRate, r.trialCostUsd, r.costPerTrial, r.costPerConvertedTrial, r.provisional]),
    );
  } else {
    notFound();
  }

  const name = `fiscallm-${kind}${kind === "trials" ? "" : `-${days}d`}.csv`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
