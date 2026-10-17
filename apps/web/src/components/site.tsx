import Link from "next/link";
import { LogoMark } from "./logo-mark";
import type { ReactNode } from "react";

export const CONTACT = "theaicommit@gmail.com";

export function Logo() {
  return (
    <span className="flex items-center gap-2 text-lg font-semibold tracking-tight">
      <LogoMark className="h-7 w-7 drop-shadow-sm" />
      FiscaLLM
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-40 border-b border-black/5">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <Link href="/#problem" className="hidden rounded-full px-3 py-1.5 text-muted hover:text-foreground sm:block">
            Problem
          </Link>
          <Link href="/#how" className="hidden rounded-full px-3 py-1.5 text-muted hover:text-foreground sm:block">
            How it works
          </Link>
          <Link href="/demo" className="hidden rounded-full px-3 py-1.5 text-muted hover:text-foreground sm:block">
            Demo
          </Link>
          <Link href="/how-it-works" className="hidden rounded-full px-3 py-1.5 text-muted hover:text-foreground sm:block">
            For engineers
          </Link>
          <a href="https://github.com/magna56/fiscallm" className="hidden rounded-full px-3 py-1.5 text-muted hover:text-foreground md:block">
            GitHub
          </a>
          <Link href="/docs" className="rounded-full px-3 py-1.5 text-muted hover:text-foreground">
            Docs
          </Link>
          <Link href="/login" className="rounded-full px-3 py-1.5 text-muted hover:text-foreground">
            Sign in
          </Link>
          <Link href="/login" className="rounded-full bg-foreground px-4 py-1.5 font-medium text-white transition hover:opacity-85">
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-black/5">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted">
        <Logo />
        <nav className="flex flex-wrap gap-5">
          <Link href="/docs" className="hover:text-foreground">Docs</Link>
          <Link href="/how-it-works" className="hover:text-foreground">How it works</Link>
          <Link href="/guides" className="hover:text-foreground">Guides</Link>
          <a href="https://github.com/magna56/fiscallm" className="hover:text-foreground">GitHub</a>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <a href={`mailto:${CONTACT}`} className="hover:text-foreground">{CONTACT}</a>
        </nav>
      </div>
    </footer>
  );
}

/** Long-form text pages: docs, privacy, terms. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-16 pt-10 text-[15px] leading-relaxed [&_a]:text-accent [&_a]:underline [&_code]:rounded [&_code]:bg-black/[0.04] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_h1]:mb-2 [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_p]:text-foreground/80 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-black/5 [&_pre]:bg-[#fafafc] [&_pre]:p-4 [&_pre]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:my-4 [&_table]:w-full [&_table]:text-sm [&_td]:border-t [&_td]:border-black/5 [&_td]:py-2 [&_td]:pr-3 [&_th]:py-2 [&_th]:pr-3 [&_th]:text-left [&_th]:font-medium [&_ul]:list-disc [&_ul]:pl-5">
      {children}
    </div>
  );
}
