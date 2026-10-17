import Link from "next/link";
import { RANGE_DAYS } from "@/lib/range";

export function RangePicker({ base, days, query }: { base: string; days: number; query?: string }) {
  return (
    <div className="inline-flex rounded border border-foreground/15 text-sm">
      {RANGE_DAYS.map((d) => (
        <Link
          key={d}
          href={`${base}?${query ? `${query}&` : ""}days=${d}`}
          className={`px-3 py-1 ${d === days ? "bg-foreground text-background" : "text-foreground/70 hover:text-foreground"}`}
        >
          {d} days
        </Link>
      ))}
    </div>
  );
}
