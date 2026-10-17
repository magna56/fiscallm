import Link from "next/link";
import { RANGE_DAYS } from "@/lib/range";

export function RangePicker({ base, days, query }: { base: string; days: number; query?: string }) {
  return (
    <div className="inline-flex rounded-full border border-black/[0.08] bg-white p-0.5 text-sm shadow-sm">
      {RANGE_DAYS.map((d) => (
        <Link
          key={d}
          href={`${base}?${query ? `${query}&` : ""}days=${d}`}
          className={`rounded-full px-3 py-1 transition ${d === days ? "bg-foreground text-white" : "text-black/60 hover:text-foreground"}`}
        >
          {d} days
        </Link>
      ))}
    </div>
  );
}
