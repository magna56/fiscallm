"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["", "Overview"],
  ["/plans", "Plans"],
  ["/trials", "Trials"],
  ["/users", "Users"],
  ["/setup", "Setup"],
  ["/settings", "Settings"],
] as const;

export function NavLinks({ appId }: { appId: string }) {
  const path = usePathname();
  const base = `/dashboard/${appId}`;
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-foreground/10 text-sm">
      {TABS.map(([suffix, label]) => {
        const href = base + suffix;
        const active = path === href;
        return (
          <Link
            key={label}
            href={href}
            className={`whitespace-nowrap border-b-2 px-3 py-2 ${active ? "border-foreground font-medium" : "border-transparent text-foreground/60 hover:text-foreground"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
