import { schema } from "@fiscallm/shared";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AppNav } from "./app-nav";
import { Logo } from "./site";

/** The signed-in layout: a sidebar with the app switcher and pages, then the page. */
export async function AppShell({ appId, children }: { appId?: string; children: ReactNode }) {
  const user = await requireUser();
  const apps = await getDb()
    .select({ id: schema.apps.id, name: schema.apps.name })
    .from(schema.apps)
    .where(eq(schema.apps.ownerId, user.id))
    .orderBy(desc(schema.apps.createdAt));
  const current = apps.find((a) => a.id === appId);

  const switcher = (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm shadow-sm">
        <span className="flex min-w-0 items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-gradient-to-br from-[#6d5dfc]/15 to-[#ec4899]/15 text-xs font-semibold text-[#4c3fd1]">
            {(current?.name ?? "A").slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate font-medium">{current?.name ?? "All apps"}</span>
        </span>
        <span className="text-black/40 transition group-open:rotate-180">▾</span>
      </summary>
      <div className="absolute left-0 right-0 z-30 mt-1 rounded-xl border border-black/[0.08] bg-white p-1 shadow-xl">
        {apps.map((a) => (
          <Link key={a.id} href={`/dashboard/${a.id}`} className={`block truncate rounded-lg px-3 py-2 text-sm hover:bg-black/[0.03] ${a.id === appId ? "font-medium text-[#4c3fd1]" : ""}`}>
            {a.name}
          </Link>
        ))}
        <Link href="/dashboard" className="block rounded-lg px-3 py-2 text-sm text-black/60 hover:bg-black/[0.03]">
          All apps · New app
        </Link>
      </div>
    </details>
  );

  const footer = (
    <div className="flex flex-col gap-1 text-sm">
      <Link href="/account" className="rounded-xl px-3 py-2 text-black/60 hover:bg-black/[0.03] hover:text-foreground">
        Account
      </Link>
      <Link href="/docs" className="rounded-xl px-3 py-2 text-black/60 hover:bg-black/[0.03] hover:text-foreground">
        Docs
      </Link>
      <form action="/auth/signout" method="post">
        <button type="submit" className="w-full rounded-xl px-3 py-2 text-left text-black/60 hover:bg-black/[0.03] hover:text-foreground">
          Sign out
        </button>
      </form>
      <div className="truncate px-3 pt-2 text-xs text-black/40">{user.email}</div>
    </div>
  );

  return (
    <div className="flex min-h-full flex-1 bg-[#f7f7fb]">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-5 border-r border-black/[0.06] bg-white/70 p-4 backdrop-blur md:flex">
        <Link href="/dashboard" className="px-1 pt-1">
          <Logo />
        </Link>
        {switcher}
        {appId && <AppNav appId={appId} />}
        <div className="mt-auto">{footer}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-20 flex flex-col gap-3 border-b border-black/[0.06] px-4 py-3 md:hidden">
          <div className="flex items-center justify-between">
            <Link href="/dashboard">
              <Logo />
            </Link>
            <Link href="/account" className="text-sm text-black/60">
              Account
            </Link>
          </div>
          {switcher}
          {appId && <AppNav appId={appId} />}
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}
