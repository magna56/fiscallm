"use client";

import Link from "next/link";
import { useState } from "react";
import { CostChart } from "./cost-chart";
import data from "./demo-dashboard-data.json";
import { Money, Table } from "./table";
import { Stat } from "./stat";
import { Card, PageHeader, pct, usd } from "./ui";

// A read-only dashboard on sample data, built from the same components as the
// signed-in one, so visitors can click around before they sign up.

const TABS = [
  ["Overview", "M3 12h4l3-8 4 16 3-8h4"],
  ["Users", "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6"],
  ["Plans", "M4 6h16M4 12h16M4 18h10"],
  ["Trials", "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18"],
] as const;
type Tab = (typeof TABS)[number][0];

interface UserRow { userId: string; state: string | null; productId: string | null; requests: number; costUsd: number; revenueUsd: number }
const USERS: UserRow[] = [
  { userId: "user_p7w2", state: "paid", productId: "pro_monthly", requests: 3120, costUsd: 31.82, revenueUsd: 7.49 },
  { userId: "user_k3x9", state: "paid", productId: "pro_monthly", requests: 2411, costUsd: 23.9, revenueUsd: 7.49 },
  { userId: "user_m4d1", state: "paid", productId: "pro_monthly", requests: 1680, costUsd: 14.27, revenueUsd: 7.49 },
  { userId: "user_t8q5", state: "paid", productId: "pro_annual", requests: 1342, costUsd: 11.63, revenueUsd: 5.41 },
  { userId: "user_c2n6", state: "cancelled", productId: "pro_monthly", requests: 702, costUsd: 6.18, revenueUsd: 7.49 },
  { userId: "user_h9v3", state: "paid", productId: "plus_monthly", requests: 412, costUsd: 2.94, revenueUsd: 3.74 },
  { userId: "user_r1b8", state: "paid", productId: "plus_monthly", requests: 190, costUsd: 0.81, revenueUsd: 3.74 },
  { userId: "user_j5e4", state: "paid", productId: "pro_annual", requests: 96, costUsd: 0.42, revenueUsd: 5.41 },
  { userId: "user_a6y7", state: "paid", productId: "plus_monthly", requests: 41, costUsd: 0.17, revenueUsd: 3.74 },
  { userId: "user_f0z2", state: null, productId: null, requests: 380, costUsd: 0.96, revenueUsd: 0 },
].map((u) => u);

interface PlanRow { productId: string; users: number; revenueUsd: number; costUsd: number }
const PLANS: PlanRow[] = [
  { productId: "pro_monthly", users: 41, revenueUsd: 452.1, costUsd: 498.31 },
  { productId: "pro_annual", users: 9, revenueUsd: 192.73, costUsd: 126.35 },
  { productId: "plus_monthly", users: 38, revenueUsd: 263.4, costUsd: 119.02 },
];

interface TrialRow { week: string; trials: number; converted: number; trialCostUsd: number; provisional: boolean }
const TRIALS: TrialRow[] = [
  { week: "2026-10-12", trials: 14, converted: 3, trialCostUsd: 18.2, provisional: true },
  { week: "2026-10-05", trials: 19, converted: 6, trialCostUsd: 31.45, provisional: true },
  { week: "2026-09-28", trials: 17, converted: 5, trialCostUsd: 27.9, provisional: false },
  { week: "2026-09-21", trials: 22, converted: 7, trialCostUsd: 41.08, provisional: false },
  { week: "2026-09-14", trials: 16, converted: 3, trialCostUsd: 36.51, provisional: false },
];

const div = (a: number, b: number) => (b > 0 ? a / b : null);

export function DemoDashboard() {
  const [tab, setTab] = useState<Tab>("Overview");
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pb-16 pt-6 md:flex-row md:gap-8 md:px-6">
      <aside className="md:w-48 md:shrink-0">
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm shadow-sm">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-[#6d5dfc]/15 to-[#ec4899]/15 text-xs font-semibold text-[#4c3fd1]">D</span>
          <span className="font-medium">Demo app</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {TABS.map(([label, d]) => (
            <button
              key={label}
              onClick={() => setTab(label)}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${tab === label ? "bg-[#6d5dfc]/10 font-medium text-[#4c3fd1]" : "text-black/60 hover:bg-black/[0.04]"}`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={d} />
              </svg>
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-6 hidden rounded-2xl bg-gradient-to-br from-[#6d5dfc] to-[#a855f7] p-4 text-sm text-white md:block">
          <p className="font-medium">This is sample data.</p>
          <p className="mt-1 text-white/80">Connect your backend to see your own users.</p>
          <Link href="/login" className="mt-3 inline-block rounded-full bg-white px-4 py-1.5 font-medium text-[#4c3fd1]">
            Start free
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {tab === "Overview" && <Overview />}
        {tab === "Users" && <Users />}
        {tab === "Plans" && <Plans />}
        {tab === "Trials" && <Trials />}
      </div>
    </div>
  );
}

function Overview() {
  const total = (rows: { costUsd: number }[]) => rows.reduce((s, r) => s + r.costUsd, 0);
  return (
    <>
      <PageHeader title="Demo app" subtitle="Last 30 days · sample data" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="AI cost" value={usd(data.costUsd)} hint={`${data.requests.toLocaleString()} requests`} />
        <Stat label="Net revenue" value={usd(data.revenueUsd)} hint="after store fees and tax" />
        <Stat label="AI cost / revenue" value={pct(data.costShare)} tone="bad" />
        <Stat label="Margin after AI" value={usd(data.marginUsd)} tone="good" />
        <Stat label="Free or unmatched" value={usd(data.unmatchedCostUsd)} hint={`${pct(data.matchRate)} of users matched`} />
      </div>
      <Card title="Daily AI cost and net revenue">
        <CostChart data={data.daily} />
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        {(
          [
            ["Cost by model", data.byModel],
            ["Cost by feature", data.byFeature],
          ] as const
        ).map(([title, rows]) => (
          <Card key={title} title={title}>
            <ul className="flex flex-col gap-2 text-sm">
              {rows.map((r) => (
                <li key={r.key}>
                  <div className="flex justify-between gap-3">
                    <span className="truncate font-mono text-xs">{r.key}</span>
                    <span className="shrink-0 tabular-nums">{usd(r.costUsd)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded bg-foreground/5">
                    <div className="h-1.5 rounded bg-foreground/40" style={{ width: `${(r.costUsd / total(rows)) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}

function Users() {
  const [losing, setLosing] = useState(false);
  const rows = USERS.map((u) => ({ ...u, marginUsd: u.revenueUsd - u.costUsd }))
    .filter((u) => !losing || (u.state !== null && u.marginUsd < 0))
    .sort((a, b) => a.marginUsd - b.marginUsd);
  const pill = (on: boolean) => `rounded-full px-3 py-1 ${on ? "bg-foreground text-white" : "text-black/60"}`;
  return (
    <>
      <PageHeader title="Users" subtitle="Worst margin first." />
      <div className="inline-flex w-fit rounded-full border border-black/[0.08] bg-white p-0.5 text-sm shadow-sm">
        <button onClick={() => setLosing(false)} className={pill(!losing)}>All users</button>
        <button onClick={() => setLosing(true)} className={pill(losing)}>Paying and losing money</button>
      </div>
      <Card title="Users, worst margin first">
        <Table
          rows={rows}
          rowKey={(r) => r.userId}
          empty="No users."
          columns={[
            { label: "User", cell: (r) => <span className="font-mono text-xs">{r.userId}</span> },
            { label: "Status", cell: (r) => r.state ?? <span className="text-foreground/50">free or unmatched</span> },
            { label: "Plan", cell: (r) => <span className="font-mono text-xs">{r.productId ?? ""}</span> },
            { label: "Requests", cell: (r) => r.requests.toLocaleString(), align: "right" },
            { label: "AI cost", cell: (r) => <Money v={r.costUsd} />, align: "right" },
            { label: "Net revenue", cell: (r) => <Money v={r.revenueUsd} />, align: "right" },
            { label: "Margin", cell: (r) => <Money v={r.marginUsd} />, align: "right" },
          ]}
        />
      </Card>
    </>
  );
}

function Plans() {
  const rows = PLANS.map((p) => ({ ...p, marginUsd: p.revenueUsd - p.costUsd, costShare: div(p.costUsd, p.revenueUsd) })).sort((a, b) => a.marginUsd - b.marginUsd);
  return (
    <>
      <PageHeader title="Plans" subtitle="Revenue, AI cost and margin per product." />
      <Card title="Plans, worst margin first">
        <Table
          rows={rows}
          rowKey={(r) => r.productId}
          empty="No plans."
          columns={[
            { label: "Product", cell: (r) => <span className="font-mono text-xs">{r.productId}</span> },
            { label: "Users", cell: (r) => r.users, align: "right" },
            { label: "Net revenue", cell: (r) => <Money v={r.revenueUsd} />, align: "right" },
            { label: "AI cost", cell: (r) => <Money v={r.costUsd} />, align: "right" },
            { label: "Margin", cell: (r) => <Money v={r.marginUsd} />, align: "right" },
            { label: "Cost / revenue", cell: (r) => pct(r.costShare), align: "right" },
          ]}
        />
        <p className="mt-3 text-xs text-foreground/50">Each user&apos;s AI cost counts toward the plan they are on now.</p>
      </Card>
    </>
  );
}

function Trials() {
  return (
    <>
      <PageHeader title="Trials" subtitle="What free trials cost you, by start week." />
      <Card title="Trial cohorts by start week">
        <Table
          rows={TRIALS}
          rowKey={(r) => r.week}
          empty="No trials."
          columns={[
            {
              label: "Week of",
              cell: (r) => (
                <span>
                  {r.week} {r.provisional && <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-700">in progress</span>}
                </span>
              ),
            },
            { label: "Trials", cell: (r) => r.trials, align: "right" },
            { label: "Converted", cell: (r) => r.converted, align: "right" },
            { label: "Conversion", cell: (r) => pct(div(r.converted, r.trials)), align: "right" },
            { label: "AI cost in trial", cell: (r) => usd(r.trialCostUsd), align: "right" },
            { label: "Per trial", cell: (r) => usd(div(r.trialCostUsd, r.trials)), align: "right" },
            { label: "Per converted trial", cell: (r) => usd(div(r.trialCostUsd, r.converted)), align: "right" },
          ]}
        />
      </Card>
    </>
  );
}
