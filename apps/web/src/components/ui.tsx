import type { ComponentProps, ReactNode } from "react";

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-foreground/10 p-5 ${className}`}>
      {title && <h2 className="mb-3 font-medium">{title}</h2>}
      {children}
    </section>
  );
}

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-foreground text-background",
    secondary: "border border-foreground/20",
    danger: "border border-red-600/60 text-red-600",
  }[variant];
  return <button className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${styles} ${className}`} {...props} />;
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`rounded border border-foreground/20 bg-transparent px-3 py-1.5 text-sm ${className}`} {...props} />;
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-[0.85em] break-all">{children}</code>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: ReactNode }) {
  const styles = {
    info: "border-foreground/15 bg-foreground/5",
    error: "border-red-600/40 bg-red-600/5 text-red-700 dark:text-red-400",
    ok: "border-green-600/40 bg-green-600/5 text-green-700 dark:text-green-400",
  }[tone];
  return <div className={`rounded border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}

export const usd = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined
    ? "–"
    : n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, Math.abs(n) < 1 && n !== 0 ? 4 : digits) });

export const pct = (n: number | null | undefined) => (n === null || n === undefined ? "–" : `${(n * 100).toFixed(1)}%`);
