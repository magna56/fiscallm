import Link from "next/link";
import type { ReactNode } from "react";
import { CodeTabs, type CodeToken, Spotlight } from "@/components/fx";
import { FlowDemo } from "@/components/flow-demo";

// Sections of the "For apps" page: cost per user, limits by plan and margin.

const STEPS = [
  {
    n: "01",
    title: "Track AI calls on your backend",
    body: "Add one line after each AI request. The SDK reports token counts in the background and never slows or breaks your response.",
    code: "meter.trackOpenAI(res, { userId })",
  },
  {
    n: "02",
    title: "Connect your revenue",
    body: "Press Connect RevenueCat, connect Stripe and import the last 12 months, or upload a CSV from any billing system. Purchases, renewals, trials and refunds count net of fees and tax.",
    code: "https://fiscallm.com/api/webhooks/rc/…",
  },
  {
    n: "03",
    title: "Set limits, see margins",
    body: "Give each plan its AI allowance and ask before each call. The dashboard shows who is at a limit and what every user, plan and trial costs against what it earns.",
    code: "meter.check(userId)  →  3 left today",
  },
];

export function PlanLimits() {
  const rules: [string, string, string][] = [
    ["free", "10 AI calls", "a day"],
    ["trial", "30 AI calls", "a day"],
    ["pro_monthly", "500 AI calls", "a month"],
    ["paid", "$8.00 of AI", "a month"],
  ];
  const points: [string, string][] = [
    ["No quota table, no reset job", "FiscaLLM already counts every AI call per user and already knows their plan. A limit is one row of settings."],
    ["A number your app can show", "Each check returns used, remaining and the reset time, so the app shows \"3 left today\" before the paywall, not an error after."],
    ["Change limits without a release", "Tighten the free plan or loosen Pro from the dashboard. No deploy, no app review."],
  ];
  return (
    <section id="limits" className="mx-auto mt-28 w-full max-w-6xl scroll-mt-24 px-6">
      <SectionHead
        eyebrow="Limits by plan"
        title={
          <>
            One check before each AI call. <span className="text-gradient">Allow, or paywall.</span>
          </>
        }
        body="You decide what each plan gets. FiscaLLM tracks who has used what."
      />
      <div className="reveal mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2">
        <div className="card-glow spot rounded-2xl border border-black/5 bg-white p-6">
          <h3 className="font-semibold">1. Set what each plan gets</h3>
          <ul className="mt-4 divide-y divide-black/5 text-sm">
            {rules.map(([plan, amount, period]) => (
              <li key={plan} className="flex items-center justify-between gap-3 py-2.5">
                <code className="rounded-md bg-[#fafafc] px-2 py-0.5 font-mono text-xs">{plan}</code>
                <span>
                  <strong>{amount}</strong> <span className="text-muted">{period}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Plans come from RevenueCat or Stripe. A product&apos;s own limit overrides &quot;paid&quot;.</p>
        </div>
        <div className="card-glow spot rounded-2xl border border-black/5 bg-white p-6">
          <h3 className="font-semibold">2. Ask before each AI call</h3>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-[#0f0f1a] p-4 text-xs leading-relaxed text-white/90">
            <code>{`const { allow, limits } = await meter.check(userId);
if (!allow) return paywall();

// → { allow: true, plan: "free",
//     limits: [{ period: "day", limit: 10,
//                used: 7, remaining: 3,
//                resetsAt: "…T00:00:00Z" }] }`}</code>
          </pre>
          <p className="mt-3 text-xs text-muted">
            Also plain HTTP: <code>POST /api/v1/check</code>. TypeScript and Python SDKs.
          </p>
        </div>
      </div>
      <Spotlight className="mt-4 grid gap-4 md:grid-cols-3">
        {points.map(([t, b]) => (
          <div key={t} className="reveal card-glow spot rounded-2xl border border-black/5 bg-white p-6">
            <h3 className="font-semibold">{t}</h3>
            <p className="mt-1.5 text-sm text-muted">{b}</p>
          </div>
        ))}
      </Spotlight>
      <p className="mt-6 text-center text-sm">
        <Link href="/guides/ai-usage-limits-by-plan" className="font-medium text-accent hover:underline">
          How to limit AI usage per plan →
        </Link>
        <span className="mx-2 text-muted">·</span>
        <Link href="/docs#plan-limits" className="font-medium text-accent hover:underline">
          Reference →
        </Link>
      </p>
    </section>
  );
}

export function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: ReactNode; body?: string }) {
  return (
    <div className="reveal mx-auto max-w-2xl text-center">
      <p className="shimmer text-sm font-medium">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-lg text-muted">{body}</p>}
    </div>
  );
}

export function Problem() {
  const points: [string, string][] = [
    ["Flat price, variable cost", "Everyone pays $9.99. One user costs you $0.20 in AI, another $25."],
    ["Two bills that never meet", "Your AI bill shows tokens. Your billing system shows payments. Neither shows the user."],
    ["You find out too late", "All you see is one big AI bill at the end of the month."],
  ];
  return (
    <section id="problem" className="mx-auto mt-28 w-full max-w-6xl scroll-mt-24 px-6">
      <SectionHead
        eyebrow="Why limits need cost data"
        title={
          <>
            AI apps lose money on <span className="text-gradient">users they can&apos;t see</span>
          </>
        }
      />
      <ol className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
        {points.map(([t, b], i) => (
          <li key={t} className="reveal rounded-2xl border border-red-500/10 bg-gradient-to-b from-red-50/60 to-white p-6">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-red-500/10 text-sm font-semibold text-red-600">{i + 1}</span>
            <h3 className="mt-3 font-semibold">{t}</h3>
            <p className="mt-1.5 text-sm text-muted">{b}</p>
          </li>
        ))}
      </ol>
      <div className="reveal mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
        <UserCompare name="Light user" plan="$9.99 / month" pays={7.49} cost={0.2} />
        <UserCompare name="Heavy user" plan="$9.99 / month" pays={7.49} cost={25} />
      </div>
      <p className="mt-3 text-center text-sm text-muted">Same plan, same price. Without FiscaLLM, both look the same.</p>
      <p className="mt-2 text-center text-sm">
        <Link href="/demo" className="font-medium text-accent hover:underline">
          See what this looks like in a dashboard →
        </Link>
      </p>
    </section>
  );
}

export function Solution() {
  const points: [string, string][] = [
    ["Joins cost and revenue, per user", "One line in your backend reports AI usage. RevenueCat, Stripe (with 12 months of history) or a CSV upload reports payments."],
    ["Shows your real margin", "Per user, per plan, per free trial, and which model or feature drives the bill."],
    ["Warns you, and can say no", "Email, Slack or webhook alerts when a user goes over budget or loops. Mark a budget as Block and your backend can refuse them."],
  ];
  return (
    <section className="mx-auto mt-28 w-full max-w-6xl px-6">
      <SectionHead
        eyebrow="The solution"
        title={
          <>
            FiscaLLM <span className="text-gradient">joins them, per user</span>
          </>
        }
      />
      <Spotlight className="mt-10 grid gap-4 md:grid-cols-3">
        {points.map(([t, b], i) => (
          <div key={t} className="reveal card-glow spot rounded-2xl border border-black/5 bg-white p-6">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#6d5dfc]/10 text-sm font-semibold text-accent">{i + 1}</span>
            <h3 className="mt-3 font-semibold">{t}</h3>
            <p className="mt-1.5 text-sm text-muted">{b}</p>
          </div>
        ))}
      </Spotlight>
    </section>
  );
}

function UserCompare({ name, plan, pays, cost }: { name: string; plan: string; pays: number; cost: number }) {
  const margin = pays - cost;
  const max = 25;
  const fmt = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`;
  return (
    <div className="spot card-glow rounded-2xl border border-black/5 bg-white p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">{name}</h3>
        <span className="text-xs text-muted">{plan}</span>
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <div className="flex justify-between">
            <dt className="text-muted">Pays you</dt>
            <dd className="tabular-nums">{fmt(pays)}</dd>
          </div>
          <div className="mt-1 h-2 rounded-full bg-black/[0.04]">
            <div className="h-2 rounded-full bg-green-400" style={{ width: `${(pays / max) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between">
            <dt className="text-muted">Costs you in AI</dt>
            <dd className="tabular-nums">{fmt(cost)}</dd>
          </div>
          <div className="mt-1 h-2 rounded-full bg-black/[0.04]">
            <div className="h-2 rounded-full bg-red-400" style={{ width: `${Math.max(1, (cost / max) * 100)}%` }} />
          </div>
        </div>
        <div className="flex justify-between border-t border-black/5 pt-3 font-semibold">
          <dt>Margin</dt>
          <dd className={`tabular-nums ${margin < 0 ? "text-red-600" : "text-green-600"}`}>{fmt(margin)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function Actions() {
  const actions: [string, string][] = [
    ["Turn free users into subscribers", "The Limits page lists who has used up their plan today. They are the users most likely to pay for more."],
    ["Price plans on real numbers", "See which plan loses money once AI is paid for, and set its limit from what a call really costs."],
    ["Cap heavy users", "Mark a budget as Block, and meter.check(userId) tells your backend to refuse the user or use a cheaper model. A capped user stays capped even if FiscaLLM goes down."],
    ["See what failed jobs cost you", "Credits refunded on a failed render, or a timeout never reconciled: the Jobs page shows what you paid the provider anyway, per user."],
    ["Switch the expensive feature", "Find the feature and model behind the bill; move it to a cheaper model."],
    ["Fix trials that don't pay off", "Know what each trial and each conversion costs."],
    ["Catch runaway loops", "By email, Slack or webhook, when a user goes over budget or burns a huge number of tokens in 5 minutes."],
    ["A Monday email", "Last week's margin and who lost you money."],
  ];
  return (
    <section className="mx-auto mt-32 w-full max-w-6xl px-6">
      <SectionHead
        eyebrow="What you can do with it"
        title="Turn the numbers into decisions"
      />
      <Spotlight className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map(([t, b], i) => (
          <div key={t} className="reveal card-glow spot rounded-2xl border border-black/5 bg-white p-6">
            <span className="text-sm font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-2 font-semibold">{t}</h3>
            <p className="mt-2 text-sm text-muted">{b}</p>
          </div>
        ))}
      </Spotlight>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto mt-32 w-full max-w-6xl scroll-mt-24 px-6">
      <SectionHead eyebrow="For your product" title="Watch one request" body="Nothing sits between your app and the AI. Usage and revenue are reported on the side." />
      <div className="reveal mt-12">
        <FlowDemo />
      </div>
      <p className="mt-6 text-center text-sm">
        <Link href="/how-it-works" className="font-medium text-accent hover:underline">
          Engineer? See exactly how it works →
        </Link>
        <span className="mx-2 text-muted">·</span>
        <Link href="/demo" className="font-medium text-accent hover:underline">
          Or try the live demo →
        </Link>
      </p>
      <h3 className="mt-20 text-center text-2xl font-semibold tracking-tight">Set up in ten minutes</h3>
      <ol className="relative mt-14 grid gap-6 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="reveal card-glow spot relative rounded-2xl border border-black/5 bg-white p-6">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#6d5dfc] to-[#a855f7] text-sm font-semibold text-white shadow-md shadow-indigo-500/30">
              {s.n}
            </span>
            <h3 className="mt-5 font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-muted">{s.body}</p>
            <code className="mt-4 block truncate rounded-lg bg-[#fafafc] px-3 py-2 font-mono text-xs text-foreground/70">{s.code}</code>
          </li>
        ))}
      </ol>
    </section>
  );
}

const K = "#c792ea";
const F = "#82aaff";
const S = "#c3e88d";
const C = "rgba(255,255,255,0.4)";
const CODE: CodeToken[] = [
  ["import", K], [" { createMeter } "], ["from", K], [" "], ['"fiscallm"', S], [";\n\n"],
  ["const", K], [" meter = "], ["createMeter", F], ["({\n  apiKey: env.FISCALLM_KEY,\n  waitUntil: ctx.waitUntil."], ["bind", F], ["(ctx),\n});\n\n"],
  ["const", K], [" res = "], ["await", K], [" openai.chat.completions\n  ."], ["create", F], ["({ model, messages });\n\n"],
  ["// that's it", C], ["\nmeter."], ["trackOpenAI", F], ["(res, { userId, feature: "], ['"chat"', S], [" });"],
];

const PY_CODE: CodeToken[] = [
  ["from", K], [" fiscallm "], ["import", K], [" Meter\n\n"],
  ["meter = "], ["Meter", F], ["(api_key=os.environ["], ['"FISCALLM_KEY"', S], ["])\n\n"],
  ["res = client.chat.completions."], ["create", F], ["(\n    model=model, messages=messages,\n)\n\n"],
  ["# that's it", C], ["\nmeter."], ["track_openai", F], ["(res, user_id=user_id, feature="], ['"chat"', S], [")"],
];

export function CodeSection() {
  return (
    <section className="mx-auto mt-32 grid w-full max-w-6xl items-center gap-10 px-6 md:grid-cols-2">
      <div className="reveal">
        <p className="shimmer text-sm font-medium">For developers</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">One line per AI call</h2>
        <p className="mt-4 text-lg text-muted">
          TypeScript and Python SDKs with zero dependencies. OpenAI, Anthropic, Gemini, streaming, images and voice.
        </p>
        <ul className="mt-6 space-y-2 text-sm">
          {[
            "Reads only the model name and token counts from res, never the answer text",
            "Never throws, never blocks your response",
            "Batches in the background with waitUntil",
            "Retries are de-duplicated, so nothing counts twice",
            "Or let your AI assistant set it up with our setup skill",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-accent">✓</span>
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">
          Already tracing? Skip the SDK and send usage from{" "}
          <Link href="/integrations/opentelemetry" className="text-accent hover:underline">OpenTelemetry</Link>,{" "}
          <Link href="/integrations/vercel-ai-sdk" className="text-accent hover:underline">the Vercel AI SDK</Link> or{" "}
          <Link href="/integrations/litellm" className="text-accent hover:underline">LiteLLM</Link>. Agents can read prices and margins through{" "}
          <Link href="/mcp" className="text-accent hover:underline">the MCP server</Link>.
        </p>
        <Link href="/docs" className="mt-6 inline-block font-medium text-accent hover:underline">
          Read the docs →
        </Link>
      </div>
      <div className="reveal relative">
        <div className="glow" aria-hidden />
        <CodeTabs
          tabs={[
            { label: "TypeScript", file: "worker.ts", tokens: CODE },
            { label: "Python", file: "app.py", tokens: PY_CODE },
          ]}
        />
      </div>
    </section>
  );
}
