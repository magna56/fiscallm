import { CostChart } from "./cost-chart";
import data from "./demo-dashboard-data.json";
import { Stat } from "./stat";

// The landing page's product shot, rendered from the same components as the
// real dashboard with the Demo app's numbers, so it stays sharp at any size.

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function DashboardPreview() {
  return (
    <div className="pointer-events-none select-none bg-white p-4 text-left sm:p-6" aria-label="Example FiscaLLM dashboard">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-4 text-xs text-black/50 sm:text-sm">
          {["Overview", "Plans", "Trials", "Users"].map((t, i) => (
            <span key={t} className={i === 0 ? "border-b-2 border-foreground pb-1 font-medium text-foreground" : ""}>
              {t}
            </span>
          ))}
        </div>
        <div className="hidden rounded border border-black/10 text-xs sm:flex">
          {["7 days", "30 days", "90 days"].map((d) => (
            <span key={d} className={`px-2.5 py-1 ${d === "30 days" ? "bg-foreground text-white" : "text-black/60"}`}>
              {d}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
        <Stat label="AI cost" value={usd(data.costUsd)} hint={`${data.requests.toLocaleString()} requests`} />
        <Stat label="Net revenue" value={usd(data.revenueUsd)} hint="after store fees and tax" />
        <Stat label="AI cost / revenue" value={`${((data.costShare ?? 0) * 100).toFixed(1)}%`} tone="bad" />
        <Stat label="Margin after AI" value={usd(data.marginUsd)} tone="good" />
        <div className="hidden sm:block">
          <Stat label="Free or unmatched" value={usd(data.unmatchedCostUsd)} hint={`${((data.matchRate ?? 0) * 100).toFixed(1)}% matched`} />
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-black/10 p-4">
        <div className="mb-2 text-sm font-medium">Daily AI cost and net revenue</div>
        <CostChart data={data.daily} />
      </div>
      <div className="mt-3 hidden gap-3 sm:grid sm:grid-cols-2">
        {[
          ["Cost by model", data.byModel],
          ["Cost by feature", data.byFeature],
        ].map(([title, rows]) => (
          <div key={title as string} className="rounded-lg border border-black/10 p-4">
            <div className="mb-3 text-sm font-medium">{title as string}</div>
            <ul className="space-y-2 text-xs">
              {(rows as { key: string; costUsd: number }[]).map((r, _, all) => (
                <li key={r.key}>
                  <div className="flex justify-between">
                    <span className="font-mono">{r.key}</span>
                    <span className="tabular-nums">{usd(r.costUsd)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded bg-black/[0.05]">
                    <div className="h-1.5 rounded bg-black/40" style={{ width: `${(r.costUsd / Math.max(...all.map((x) => x.costUsd))) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
