import { schema } from "@fiscallm/shared";
import { type LimitHit, PERIOD_LABELS, PLAN_STATES, usersAtLimit } from "@fiscallm/shared/plan-limits";
import { PLAN_PERIODS } from "@fiscallm/shared/schema";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { Table } from "@/components/table";
import { Button, Card, Code, Input, Notice, PageHeader, usd } from "@/components/ui";
import { requireApp } from "@/lib/auth";
import { getDb, metricsDb } from "@/lib/db";
import { deletePlanLimit, savePlanLimit } from "../../actions";

export default function LimitsPage(props: PageProps<"/dashboard/[appId]/limits">) {
  return (
    <Suspense fallback={<p className="text-foreground/60">Loading…</p>}>
      <Limits {...props} />
    </Suspense>
  );
}

type Rule = typeof schema.planLimits.$inferSelect;

const amount = (r: Rule) =>
  [r.maxRequests !== null && `${r.maxRequests.toLocaleString("en-US")} AI calls`, r.maxCostUsd !== null && `${usd(Number(r.maxCostUsd))} of AI`].filter(Boolean).join(" or ");

const WHEN: Record<LimitHit["period"], string> = { day: "today", month: "this month", total: "in total" };

async function Limits({ params, searchParams }: PageProps<"/dashboard/[appId]/limits">) {
  const app = await requireApp((await params).appId);
  const { error, done } = await searchParams;
  const rules = await getDb()
    .select()
    .from(schema.planLimits)
    .where(eq(schema.planLimits.appId, app.id))
    .orderBy(asc(schema.planLimits.plan), asc(schema.planLimits.period));
  const products = await getDb()
    .selectDistinct({ id: schema.subscribers.productId })
    .from(schema.subscribers)
    .where(and(eq(schema.subscribers.appId, app.id), isNotNull(schema.subscribers.productId)))
    .limit(50);
  const hits = rules.length ? await usersAtLimit(metricsDb(), app.id) : [];
  const freeHits = hits.filter((h) => h.plan === "free").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Limits" subtitle="How much AI each plan gets, what is left, and who has run out." />
      {typeof error === "string" && <Notice tone="error">{error}</Notice>}
      {typeof done === "string" && <Notice tone="ok">{done}</Notice>}

      <Card title="Limits by plan">
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-foreground/70">
            Give free, trial and paying users their own AI allowance. FiscaLLM knows each user&apos;s plan from RevenueCat or Stripe, counts their AI
            calls and cost, and tells your backend whether to allow the next call and how much is left.
          </p>

          {rules.length > 0 && (
            <ul className="divide-y divide-foreground/10 rounded border border-foreground/10">
              {rules.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <span className="flex-1">
                    <Code>{r.plan}</Code> <strong>{amount(r)}</strong> {PERIOD_LABELS[r.period]}
                  </span>
                  <form action={deletePlanLimit.bind(null, app.id, r.id)}>
                    <button className="text-xs text-red-600 underline">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <form action={savePlanLimit.bind(null, app.id)} className="flex flex-col gap-2 rounded border border-dashed border-foreground/15 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_130px_130px_130px_auto]">
              <Input name="plan" required list="plan-names" placeholder="Plan: free, trial, paid or a product ID" defaultValue="free" />
              <datalist id="plan-names">
                {PLAN_STATES.map((p) => (
                  <option key={p} value={p} />
                ))}
                {products.map((p) => (
                  <option key={p.id} value={p.id ?? ""} />
                ))}
              </datalist>
              <select name="period" className="rounded-xl border border-black/10 bg-white px-2 py-1.5 text-sm" defaultValue="day">
                {PLAN_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_LABELS[p]}
                  </option>
                ))}
              </select>
              <Input name="maxRequests" inputMode="numeric" placeholder="AI calls" />
              <Input name="maxCostUsd" inputMode="decimal" placeholder="or USD of AI" />
              <Button type="submit">Save limit</Button>
            </div>
            <p className="text-xs text-foreground/60">
              <strong>free</strong> is anyone without an active purchase. <strong>trial</strong> is a free trial. <strong>paid</strong> covers every
              paying user; a limit on a product ID (for example <code>pro_yearly</code>) overrides it for that product. A day and a month are UTC;
              &quot;in total&quot; never resets, for &quot;5 free tries, then subscribe&quot;. Fill in AI calls, USD, or both; saving the same plan and
              period again replaces the limit.
            </p>
          </form>
        </div>
      </Card>

      <Card title="Use it in your backend">
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-foreground/70">
            Ask before each AI call. Send <Code>remaining</Code> to your app to show &quot;3 left today&quot;, and show your paywall when{" "}
            <Code>allow</Code> is false.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-[#0f0f1a] p-4 text-xs leading-relaxed text-white/90">
            <code>{`const { allow, plan, limits } = await meter.check(userId);
if (!allow) return paywall({ plan, resetsAt: limits[0]?.resetsAt });   // HTTP 402 in an API

const reply = await openai.chat.completions.create({ ... });
meter.trackOpenAI(reply, { userId });                                   // counts against the limit

return { reply, remaining: limits[0]?.remaining };                      // "3 left today"`}</code>
          </pre>
          <p className="text-foreground/70">
            No RevenueCat or Stripe connected? Pass the plan yourself: <Code>meter.check(userId, {"{ plan: \"pro\" }"})</Code> and set a limit for{" "}
            <Code>pro</Code> above. More in the{" "}
            <Link href="/docs#plan-limits" className="underline">
              docs
            </Link>
            .
          </p>
        </div>
      </Card>

      <Card title="At a limit now">
        {rules.length === 0 ? (
          <p className="text-sm text-foreground/60">Set a limit above to see who reaches it.</p>
        ) : (
          <>
            {freeHits > 0 && (
              <p className="mb-3 text-sm text-foreground/70">
                {freeHits} free {freeHits === 1 ? "user has" : "users have"} used everything the free plan gives. They are the ones most likely to pay
                for more.
              </p>
            )}
            <Table<LimitHit>
              rows={hits}
              rowKey={(h) => `${h.userId}/${h.period}`}
              empty="Nobody is at a limit right now."
              columns={[
                { label: "User", cell: (h) => <span className="font-mono text-xs">{h.userId}</span> },
                { label: "Plan", cell: (h) => (h.plan === "free" ? "free" : `${h.plan}${h.productId ? ` · ${h.productId}` : ""}`) },
                { label: "Used", cell: (h) => (h.unit === "usd" ? usd(h.used) : `${h.used.toLocaleString("en-US")} calls`), align: "right" },
                { label: "Limit", cell: (h) => `${h.unit === "usd" ? usd(h.limit) : h.limit.toLocaleString("en-US")} ${WHEN[h.period]}`, align: "right" },
              ]}
            />
          </>
        )}
      </Card>
    </div>
  );
}
