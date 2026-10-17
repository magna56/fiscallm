import type { ReactNode } from "react";

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "bad" | "good" }) {
  const color = tone === "bad" ? "text-red-600" : tone === "good" ? "text-green-600" : "";
  const bar = tone === "bad" ? "from-red-400 to-rose-300" : tone === "good" ? "from-green-400 to-emerald-300" : "from-[#6d5dfc] to-[#a855f7]";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_2px_rgba(16,16,32,0.04)]">
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${bar} opacity-70`} />
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={`mt-1.5 text-xl font-semibold tracking-tight tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-black/45">{hint}</div>}
    </div>
  );
}
