import { breakdown, overview } from "@fiscallm/shared/metrics";
import Link from "next/link";
import { Suspense } from "react";
import { CostChart } from "@/components/cost-chart";
import { RangePicker } from "@/components/range-picker";
import { Stat } from "@/components/stat";
import { Card, Notice, PageHeader, pct, usd } from "@/components/ui";
import { SetupChecklist } from "@/components/setup-checklist";
import { setupState } from "@/lib/setup-state";
import { requireApp } from "@/lib/auth";
import { metricsDb } from "@/lib/db";
import { rangeFrom } from "@/lib/range";

export default function OverviewPage(props: PageProps<"/dashboard/[appId]">) {
  return (
    <Suspense fallback={<p className="text-foreground/60">Loading…</p>}>
      <Overview {...props} />
    </Suspense>
  );
}

async function Overview({ params, searchParams }: PageProps<"/dashboard/[appId]">) {
  const app = await requireApp((await params).appId);
  const { days, range } = rangeFrom(await searchParams);
  const db = metricsDb();
  const o = await overview(db, app.id, range);
  const b = await breakdown(db, app.id, range);
  const base = `/dashboard/${app.id}`;

  const state = await setupState(app.id);
  const empty = o.usersWithCost === 0 && o.revenueUsd === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={app.name} subtitle={`Last ${days} days`} action={<RangePicker base={base} days={days} />} />
      {!state.complete && <SetupChecklist appId={app.id} state={state} compact />}
      {empty ? (
        <Notice>
          Nothing in the last {days} days yet. Data shows here within seconds of your first event. <Link href={`${base}/setup`} className="underline">Open setup</Link>
        </Notice>
      ) : (
      <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="AI cost" value={usd(o.costUsd)} hint={`${o.requests.toLocaleString()} requests`} />
        <Stat label="Net revenue" value={usd(o.revenueUsd)} hint="after store fees and tax" />
        <Stat
          label="AI cost / revenue"
          value={pct(o.costShare)}
          tone={o.costShare !== null && o.costShare > 0.3 ? "bad" : undefined}
          hint={o.costShare === null ? "no revenue yet" : undefined}
        />
        <Stat label="Margin after AI" value={usd(o.marginUsd)} tone={o.marginUsd < 0 ? "bad" : "good"} />
        <Stat
          label="Free or unmatched"
          value={usd(o.unmatchedCostUsd)}
          hint={o.matchRate === null ? undefined : `${pct(o.matchRate)} of users matched`}
        />
      </div>

      <Card title="Daily AI cost and net revenue">
        <CostChart data={o.daily} />
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Cost by model">
          <Shares rows={b.byModel.map((m) => ({ key: m.key, cost: m.costUsd, note: m.unpriced ? `${m.unpriced} unpriced` : "" }))} />
        </Card>
        <Card title="Cost by feature">
          <Shares rows={b.byFeature.map((f) => ({ key: f.key || "(no feature)", cost: f.costUsd, note: "" }))} />
        </Card>
      </div>
      {b.range.from !== range.from ? (
        <p className="text-xs text-foreground/50">Model and feature breakdowns cover the last 90 days at most.</p>
      ) : null}
      </>
      )}
    </div>
  );
}

function Shares({ rows }: { rows: { key: string; cost: number; note: string }[] }) {
  const total = rows.reduce((s, r) => s + r.cost, 0);
  if (rows.length === 0) return <p className="text-sm text-foreground/60">No requests in this period.</p>;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {rows.slice(0, 8).map((r) => (
        <li key={r.key}>
          <div className="flex justify-between gap-3">
            <span className="truncate font-mono text-xs">{r.key}</span>
            <span className="shrink-0 tabular-nums">
              {usd(r.cost)} {r.note && <span className="text-xs text-amber-600">{r.note}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded bg-foreground/5">
            <div className="h-1.5 rounded bg-foreground/40" style={{ width: `${total ? (r.cost / total) * 100 : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
