import { CostChart } from "./cost-chart";
import { LogoMark } from "./logo-mark";
import data from "./demo-dashboard-data.json";
import { Stat } from "./stat";
import { Card, PageHeader, usd } from "./ui";

// The landing page's product shot: the real dashboard layout (sidebar,
// Overview page) built from the same components, with the Demo app's
// numbers, so what visitors see is what they get. Sharp at any size.

const NAV = [
  ["Overview", "M3 12h4l3-8 4 16 3-8h4"],
  ["Users", "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6"],
  ["Plans", "M4 6h16M4 12h16M4 18h10"],
  ["Trials", "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18"],
  ["Setup", "M4 12l5 5L20 6"],
  ["Settings", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 12h2M3 12h2M12 3v2M12 19v2"],
];

export function DashboardPreview() {
  return (
    <div className="pointer-events-none flex select-none bg-[#f7f7fb] text-left" aria-label="Example FiscaLLM dashboard">
      <aside className="hidden w-44 shrink-0 flex-col gap-3 border-r border-black/[0.06] bg-white/80 p-3 md:flex">
        <div className="flex items-center gap-1.5 px-1 pt-0.5 text-sm font-semibold">
          <LogoMark className="h-5 w-5" />
          FiscaLLM
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-2.5 py-1.5 text-xs shadow-sm">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-[#6d5dfc]/15 to-[#ec4899]/15 text-[10px] font-semibold text-[#4c3fd1]">D</span>
          <span className="font-medium">Demo</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(([label, d], i) => (
            <span key={label} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${i === 0 ? "bg-[#6d5dfc]/10 font-medium text-[#4c3fd1]" : "text-black/55"}`}>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={d} />
              </svg>
              {label}
            </span>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
        <PageHeader
          title="Demo"
          subtitle="Last 30 days"
          action={
            <div className="hidden rounded-full border border-black/[0.08] bg-white p-0.5 text-xs shadow-sm sm:inline-flex">
              {["7 days", "30 days", "90 days"].map((d) => (
                <span key={d} className={`rounded-full px-2.5 py-1 ${d === "30 days" ? "bg-foreground text-white" : "text-black/60"}`}>
                  {d}
                </span>
              ))}
            </div>
          }
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="AI cost" value={usd(data.costUsd)} hint={`${data.requests.toLocaleString()} requests`} />
          <Stat label="Net revenue" value={usd(data.revenueUsd)} hint="after store fees and tax" />
          <Stat label="AI cost / revenue" value={`${((data.costShare ?? 0) * 100).toFixed(1)}%`} tone="bad" />
          <Stat label="Margin after AI" value={usd(data.marginUsd)} tone="good" />
          <div className="hidden sm:block">
            <Stat label="Free or unmatched" value={usd(data.unmatchedCostUsd)} hint={`${((data.matchRate ?? 0) * 100).toFixed(1)}% of users matched`} />
          </div>
        </div>
        <Card title="Daily AI cost and net revenue" className="!p-4">
          <CostChart data={data.daily} />
        </Card>
        <div className="hidden gap-3 sm:grid sm:grid-cols-2">
          {[
            ["Cost by model", data.byModel],
            ["Cost by feature", data.byFeature],
          ].map(([title, rows]) => (
            <Card key={title as string} title={title as string} className="!p-4">
              <ul className="space-y-2 text-xs">
                {(rows as { key: string; costUsd: number }[]).map((r, _, all) => (
                  <li key={r.key}>
                    <div className="flex justify-between">
                      <span className="font-mono">{r.key}</span>
                      <span className="tabular-nums">{usd(r.costUsd)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-black/[0.05]">
                      <div className="h-1.5 rounded bg-black/40" style={{ width: `${(r.costUsd / all.reduce((t, x) => t + x.costUsd, 0)) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
