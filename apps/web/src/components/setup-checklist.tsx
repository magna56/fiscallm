import Link from "next/link";
import type { SetupState } from "@/lib/setup-state";

function ago(d: Date) {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

/** The three setup steps, ticked off as data arrives. */
export function SetupChecklist({ appId, state, compact = false }: { appId: string; state: SetupState; compact?: boolean }) {
  const steps = [
    {
      done: state.aiEvents > 0,
      title: "Send AI usage from your backend",
      detail: state.aiEvents > 0 ? `${state.aiEvents.toLocaleString()} events, last ${ago(state.lastAi!)}` : "Add the SDK and one line after each AI call.",
      href: "#usage",
    },
    {
      done: state.revenueEvents > 0,
      title: "Connect revenue",
      detail: state.revenueEvents > 0 ? `${state.revenueEvents.toLocaleString()} purchase events received` : "Press Connect RevenueCat, or send payments with the API.",
      href: "#revenue",
    },
    {
      done: state.complete,
      title: "See your margins",
      detail: state.complete ? "Cost and revenue are matched per user." : "Appears as soon as both are connected.",
      href: "",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="rounded-2xl border border-[#6d5dfc]/15 bg-gradient-to-br from-[#f5f3ff] via-white to-[#fdf2f8] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold tracking-tight">{state.complete ? "You're all set" : "Get set up"}</h2>
          <p className="text-sm text-muted">{doneCount} of 3 done</p>
        </div>
        {compact && !state.complete && (
          <Link href={`/dashboard/${appId}/setup`} className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white">
            Continue setup →
          </Link>
        )}
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-black/[0.06]">
        <div className="h-1.5 rounded-full bg-gradient-to-r from-[#6d5dfc] to-[#ec4899] transition-all duration-700" style={{ width: `${(doneCount / 3) * 100}%` }} />
      </div>
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => {
          const body = (
            <>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${s.done ? "bg-green-500 text-white" : "bg-white text-[#4c3fd1] ring-1 ring-[#6d5dfc]/25"}`}>
                {s.done ? "✓" : i + 1}
              </span>
              <span>
                <span className="block text-sm font-medium">{s.title}</span>
                <span className="mt-0.5 block text-xs text-muted">{s.detail}</span>
              </span>
            </>
          );
          const cls = "flex gap-3 rounded-xl bg-white/80 p-3 ring-1 ring-black/[0.04]";
          return (
            <li key={s.title}>
              {s.href && !compact ? (
                <a href={s.href} className={`${cls} transition hover:ring-[#6d5dfc]/30`}>
                  {body}
                </a>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
