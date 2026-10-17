import type { ComponentProps, ReactNode } from "react";

export function Card({ title, children, className = "", action }: { title?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_2px_rgba(16,16,32,0.04),0_8px_24px_-16px_rgba(109,93,252,0.18)] ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-semibold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-foreground text-white shadow-sm hover:bg-foreground/85",
    secondary: "border border-black/10 bg-white hover:border-black/20 hover:bg-black/[0.02]",
    danger: "border border-red-500/30 bg-white text-red-600 hover:bg-red-50",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm transition outline-none placeholder:text-black/35 focus:border-[#6d5dfc]/60 focus:ring-4 focus:ring-[#6d5dfc]/10 ${className}`}
      {...props}
    />
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-[#6d5dfc]/[0.07] px-1.5 py-0.5 font-mono text-[0.85em] text-[#4c3fd1] break-all">{children}</code>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: ReactNode }) {
  const styles = {
    info: "border-[#6d5dfc]/15 bg-[#6d5dfc]/[0.05] text-foreground/80",
    error: "border-red-500/25 bg-red-50 text-red-700",
    ok: "border-green-600/25 bg-green-50 text-green-700",
  }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

/** Page title row inside the app. */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export const usd = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined
    ? "–"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, Math.abs(n) < 1 && n !== 0 ? 4 : digits) });

export const pct = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${(n * 100).toFixed(1)}%`);
