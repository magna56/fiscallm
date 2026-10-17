import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./site";

/** Sign-in and welcome: the landing page's look, with one focused card. */
export function AuthShell({ title, subtitle, children, aside = true }: { title: string; subtitle?: string; children: ReactNode; aside?: boolean }) {
  return (
    <div className="relative isolate flex min-h-full flex-1 flex-col overflow-hidden">
      <div className="aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="dot-grid" aria-hidden />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/docs" className="text-sm text-muted hover:text-foreground">
          Docs
        </Link>
      </header>
      <main className={`relative z-10 mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 px-6 py-10 ${aside ? "md:grid-cols-2" : ""}`}>
        {aside && (
          <div className="hidden md:block">
            <h2 className="text-3xl font-semibold tracking-tight">
              See the AI cost of <span className="text-gradient">every single user.</span>
            </h2>
            <ul className="mt-6 space-y-3 text-muted">
              {["Margin per user, plan and free trial", "Which model and feature drive the bill", "Alerts before a user gets expensive", "Free and open source"].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="text-accent">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className={`glass w-full rounded-2xl border border-black/5 p-8 shadow-xl shadow-indigo-500/5 ${aside ? "" : "mx-auto max-w-md"}`}>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
