import Link from "next/link";
import type { ReactNode } from "react";

export const CONTACT = "theaicommit@gmail.com";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
      <Link href="/" className="text-lg font-semibold">
        FiscaLLM
      </Link>
      <nav className="flex items-center gap-5 text-sm">
        <Link href="/docs" className="text-foreground/70 hover:text-foreground">
          Docs
        </Link>
        <Link href="/login" className="rounded bg-foreground px-3 py-1.5 font-medium text-background">
          Sign in
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-foreground/10">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap justify-between gap-3 px-6 py-6 text-sm text-foreground/60">
        <span>FiscaLLM</span>
        <nav className="flex gap-5">
          <Link href="/docs">Docs</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
        </nav>
      </div>
    </footer>
  );
}

/** Long-form text pages: docs, privacy, terms. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-16 text-[15px] leading-relaxed [&_a]:underline [&_code]:rounded [&_code]:bg-foreground/5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_h1]:mb-2 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-foreground/5 [&_pre]:p-4 [&_pre]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:my-3 [&_table]:w-full [&_table]:text-sm [&_td]:border-t [&_td]:border-foreground/10 [&_td]:py-1.5 [&_td]:pr-3 [&_th]:py-1.5 [&_th]:pr-3 [&_th]:text-left [&_th]:font-medium [&_ul]:list-disc [&_ul]:pl-5">
      {children}
    </div>
  );
}
