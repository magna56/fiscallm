import type { ReactNode } from "react";

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "bad" | "good" }) {
  const color = tone === "bad" ? "text-red-600" : tone === "good" ? "text-green-600" : "";
  return (
    <div className="rounded-lg border border-foreground/10 p-4">
      <div className="text-xs text-foreground/60">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-foreground/50">{hint}</div>}
    </div>
  );
}
