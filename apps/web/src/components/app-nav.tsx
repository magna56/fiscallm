"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["", "Overview", "M3 12h4l3-8 4 16 3-8h4"],
  ["/users", "Users", "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6"],
  ["/plans", "Plans", "M4 6h16M4 12h16M4 18h10"],
  ["/trials", "Trials", "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18"],
  ["/setup", "Setup", "M4 12l5 5L20 6"],
  ["/settings", "Settings", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 12h2M3 12h2M12 3v2M12 19v2"],
] as const;

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Sidebar links for one app; horizontal on phones. */
export function AppNav({ appId }: { appId: string }) {
  const path = usePathname();
  const base = `/dashboard/${appId}`;
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {TABS.map(([suffix, label, icon]) => {
        const href = base + suffix;
        const active = path === href;
        return (
          <Link
            key={label}
            href={href}
            className={`flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${
              active ? "bg-[#6d5dfc]/10 font-medium text-[#4c3fd1]" : "text-black/60 hover:bg-black/[0.03] hover:text-foreground"
            }`}
          >
            <Icon d={icon} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
