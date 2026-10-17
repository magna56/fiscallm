import Link from "next/link";
import type { ReactNode } from "react";
import { CodeTabs, type CodeToken, CountUp, Spotlight } from "@/components/fx";
import { DashboardPreview } from "@/components/dashboard-preview";
import { FlowDemo } from "@/components/flow-demo";
import { SiteFooter, SiteHeader } from "@/components/site";

const RUNTIMES = ["OpenAI", "Anthropic", "Gemini", "Groq", "OpenRouter", "fal.ai", "Cloudflare Workers", "Vercel", "Supabase", "Firebase", "Node.js", "Python", "FastAPI", "Django", "AWS Lambda", "Deno", "Bun", "RevenueCat"];

const STEPS = [
  {
    n: "01",
    title: "Track AI calls on your backend",
    body: "Add one line after each AI request. The SDK reports token counts in the background and never slows or breaks your response.",
    code: "meter.trackOpenAI(res, { userId })",
  },
  {
    n: "02",
    title: "Connect RevenueCat",
    body: "Paste one webhook URL. Purchases, renewals, trials and refunds arrive as they happen, net of store fees and tax.",
    code: "https://fiscallm.com/api/webhooks/rc/…",
  },
  {
    n: "03",
    title: "See your real margin per user",
    body: "AI cost next to revenue for every user, plan and trial cohort, with the people losing you money at the top.",
    code: "demo-heavy   −$16.41",
  },
];

const FAQ: [string, string][] = [
  ["What does FiscaLLM do, in one sentence?", "It tells AI app developers which users, plans and trials make money and which lose it, so they can fix pricing and limits before the AI bill eats their margin."],
  ["What exactly does FiscaLLM store?", "User IDs, token counts, model names and RevenueCat subscription events. Never prompts or responses: those stay on your backend."],
  ["Which apps is it for?", "Subscription apps that call AI models from their own backend, in TypeScript or Python (a Cloudflare Worker, a Supabase or Firebase function, a Node, FastAPI or Django server), and that use RevenueCat. Other languages can use the HTTP API."],
  ["How is the cost calculated?", "From each provider's list price on the day of the call, including cached tokens, cache writes and long-prompt pricing. If you have a negotiated rate, add it in Settings."],
  ["What if FiscaLLM is down?", "Your app is unaffected. The SDK sends in the background with a two-second timeout and one retry, then drops the event."],
  ["What does it cost?", "Nothing during the beta. We will tell you well before any paid plan applies to you."],
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col overflow-x-clip">
      <SiteHeader />
      <main className="flex flex-col">
        <Hero />
        <Runtimes />
        <Stats />
        <Problem />
        <HowItWorks />
        <Features />
        <Actions />
        <Audience />
        <CodeSection />
        <Privacy />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate">
      <div className="aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="dot-grid" aria-hidden />
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pt-20 text-center sm:pt-28">
        <Link
          href="/docs"
          className="fade-up glass inline-flex items-center gap-2 rounded-full border border-black/5 px-3 py-1 text-xs text-muted shadow-sm"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Free during the beta · SDKs for TypeScript &amp; Python
          <span aria-hidden>→</span>
        </Link>

        <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl">
          <Words text="Know which users cost you" start={0} /> <Words text="more in AI" start={5} gradient />{" "}
          <Words text="than they pay." start={8} />
        </h1>
        <p className="fade-up delay-2 mt-6 max-w-2xl text-lg text-muted sm:text-xl">
          FiscaLLM puts every user&apos;s AI spend next to their subscription revenue, so you see your real margin per user, plan and free
          trial before the provider bill arrives.
        </p>
        <div className="fade-up delay-3 mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="btn-glow rounded-full bg-foreground px-6 py-3 font-medium text-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Start free
          </Link>
          <Link href="/docs" className="glass rounded-full border border-black/10 px-6 py-3 font-medium transition hover:-translate-y-0.5">
            Read the docs
          </Link>
        </div>
        <p className="fade-up delay-3 mt-4 text-sm text-muted">10-minute setup · No prompts leave your backend</p>

        <div className="relative mt-16 w-full max-w-5xl">
          <div className="glow" aria-hidden />
          <div className="product-frame overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl shadow-indigo-500/10">
            <div className="flex items-center gap-2 border-b border-black/5 bg-[#fafafc] px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="mx-auto rounded-md bg-black/[0.04] px-3 py-0.5 text-xs text-muted">fiscallm.com/dashboard</span>
            </div>
            <DashboardPreview />
          </div>

          <FloatCard className="float -left-4 top-[16%] hidden md:block xl:-left-44">
            <div className="text-xs text-muted">Biggest cost driver</div>
            <div className="mt-1 font-mono text-sm">claude-sonnet-5-5</div>
            <div className="mt-2 h-1.5 w-40 rounded-full bg-black/[0.05]">
              <div className="h-1.5 w-[74%] rounded-full bg-gradient-to-r from-[#6d5dfc] to-[#ec4899]" />
            </div>
            <div className="mt-1 text-xs text-muted">74% of AI cost</div>
          </FloatCard>
          <FloatCard className="float-slow -right-4 top-[46%] hidden md:block xl:-right-44">
            <div className="text-xs text-muted">Paying user losing you money</div>
            <div className="mt-1 flex items-center justify-between gap-6 font-mono text-sm">
              <span>user_k3x9…</span>
              <span className="font-semibold text-red-600">−$16.41</span>
            </div>
            <div className="mt-1 text-xs text-muted">pays $7.49 · costs $23.90</div>
          </FloatCard>
        </div>
      </div>
    </section>
  );
}

function Words({ text, start, gradient = false }: { text: string; start: number; gradient?: boolean }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i}>
          {i > 0 && " "}
          <span className={`word ${gradient ? "text-gradient" : ""}`} style={{ ["--i" as string]: start + i }}>
            {w}
          </span>
        </span>
      ))}
    </>
  );
}

function FloatCard({ className, children }: { className: string; children: ReactNode }) {
  return <div className={`glass absolute z-20 rounded-xl border border-black/5 p-4 text-left shadow-xl shadow-black/10 ${className}`}>{children}</div>;
}

function Runtimes() {
  const row = [...RUNTIMES, ...RUNTIMES];
  return (
    <section className="mx-auto mt-20 w-full max-w-6xl px-6">
      <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-muted">Works with your stack</p>
      <div className="marquee mt-6 overflow-hidden">
        <div className="marquee-track gap-10">
          {row.map((r, i) => (
            <span key={i} className="whitespace-nowrap text-lg font-medium text-foreground/40">
              {r}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const stats: [ReactNode, string][] = [
    [<CountUp key="a" to={10} suffix=" min" />, "to set up"],
    [<CountUp key="b" to={0} />, "prompts stored, ever"],
    [<CountUp key="c" to={3} />, "providers with built-in helpers"],
    [<CountUp key="d" to={2} prefix="<" suffix="s" />, "SDK timeout, never blocks"],
  ];
  return (
    <section className="mx-auto mt-20 w-full max-w-5xl px-6">
      <div className="reveal grid grid-cols-2 gap-y-8 rounded-2xl border border-black/5 bg-white/70 p-8 md:grid-cols-4">
        {stats.map(([n, label], i) => (
          <div key={i} className="text-center">
            <div className="stat-num text-4xl font-semibold tracking-tight">{n}</div>
            <div className="mt-1 text-sm text-muted">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: ReactNode; body?: string }) {
  return (
    <div className="reveal mx-auto max-w-2xl text-center">
      <p className="shimmer text-sm font-medium">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-lg text-muted">{body}</p>}
    </div>
  );
}

function Problem() {
  const items = [
    ["Flat price, variable cost", "Every subscriber pays the same, but one heavy user can cost more in AI than a hundred light ones."],
    ["Two systems that never meet", "Your AI provider's bill knows tokens. RevenueCat knows who paid. Neither knows which user is which."],
    ["Trials that quietly lose money", "Free trials run on real AI. Without numbers you cannot tell what a trial costs or what a conversion is worth."],
  ];
  return (
    <section className="mx-auto mt-32 w-full max-w-6xl px-6">
      <SectionHead
        eyebrow="The problem"
        title={
          <>
            Two users pay the same. <span className="text-gradient">One of them loses you money.</span>
          </>
        }
        body="Subscription pricing assumed software costs nothing per user. With AI, every message has a price, and you only see the total at the end of the month."
      />

      <div className="reveal mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
        <UserCompare name="Light user" plan="$9.99 / month" pays={7.49} cost={0.2} />
        <UserCompare name="Heavy user" plan="$9.99 / month" pays={7.49} cost={25} />
      </div>
      <p className="mt-3 text-center text-xs text-muted">Net revenue after store fees and tax. AI cost from the provider&apos;s list prices.</p>

      <Spotlight className="mt-12 grid gap-4 md:grid-cols-3">
        {items.map(([t, b]) => (
          <div key={t} className="reveal card-glow spot rounded-2xl border border-black/5 bg-white p-6">
            <h3 className="font-semibold">{t}</h3>
            <p className="mt-2 text-sm text-muted">{b}</p>
          </div>
        ))}
      </Spotlight>

      <div className="reveal mx-auto mt-12 flex max-w-4xl flex-col items-stretch gap-3 md:flex-row md:items-center">
        <Source title="AI provider bill" body="tokens, models, total cost" />
        <Joiner />
        <div className="flex-1 rounded-2xl bg-gradient-to-br from-[#6d5dfc] via-[#a855f7] to-[#ec4899] p-[1.5px]">
          <div className="rounded-[15px] bg-white px-5 py-4 text-center">
            <div className="font-semibold">FiscaLLM</div>
            <div className="text-sm text-muted">joins them per user: cost, revenue, margin</div>
          </div>
        </div>
        <Joiner flip />
        <Source title="RevenueCat" body="purchases, renewals, trials, refunds" />
      </div>
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

function Source({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex-1 rounded-2xl border border-black/10 bg-[#fafafc] px-5 py-4 text-center">
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted">{body}</div>
    </div>
  );
}

function Joiner({ flip = false }: { flip?: boolean }) {
  return (
    <div className="beam mx-auto h-8 w-px bg-black/10 md:h-px md:w-12" aria-hidden>
      <span className="sr-only">{flip ? "from" : "to"}</span>
    </div>
  );
}

function Actions() {
  const actions: [string, string][] = [
    ["Price plans on real numbers", "See which plan loses money once AI is paid for, and set prices or limits that keep every plan profitable."],
    ["Cap heavy users", "Set a budget per user. When someone passes it, a webhook tells your backend so it can slow them down or ask them to upgrade."],
    ["Switch the expensive feature", "Find the feature and model that drive the bill, then move it to a cheaper model where users will not notice."],
    ["Fix trials that do not pay off", "Know what a trial costs and what each converted trial costs, then shorten trials or limit AI during them."],
    ["Catch problems the same day", "Alerts when a user, the whole app or AI's share of revenue goes over your line, by email or webhook."],
    ["Stay on top every week", "A Monday email with last week's margin and the users and plans that lost money."],
  ];
  return (
    <section className="mx-auto mt-32 w-full max-w-6xl px-6">
      <SectionHead
        eyebrow="What you can do with it"
        title="Turn the numbers into decisions"
        body="Seeing the problem is step one. FiscaLLM is built around the decisions that fix it."
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

function Audience() {
  const handled = [
    "Cached tokens and long prompts",
    "Image, voice and video pricing",
    "Trials and conversions",
    "Refunds and upgrades",
    "Anonymous to logged-in users",
    "Negotiated AI prices",
    "History from before you connected",
    "Sandbox and test purchases",
  ];
  return (
    <section className="mx-auto mt-32 w-full max-w-6xl px-6">
      <div className="reveal grid gap-10 rounded-3xl border border-black/5 bg-white p-8 md:grid-cols-2 md:p-12">
        <div>
          <p className="shimmer text-sm font-medium">Who it is for</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">AI-powered subscription apps</h2>
          <p className="mt-4 text-muted">
            Indie developers and small teams whose app sells subscriptions through RevenueCat and calls OpenAI, Anthropic, Gemini or other AI
            providers from its own backend, in TypeScript or Python. For many of these apps, AI is the biggest cost after the app store&apos;s cut.
          </p>
        </div>
        <div>
          <p className="text-sm font-medium">Handles the hard parts</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {handled.map((h) => (
              <li key={h} className="rounded-full border border-black/10 bg-[#fafafc] px-3 py-1.5 text-sm">
                {h}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="mx-auto mt-32 w-full max-w-6xl scroll-mt-24 px-6">
      <SectionHead eyebrow="How it works" title="Watch one request" body="No proxy and nothing in your app's request path: your backend reports usage on the side, and RevenueCat reports revenue." />
      <div className="reveal mt-12">
        <FlowDemo />
      </div>
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

function Features() {
  return (
    <section id="features" className="mx-auto mt-32 w-full max-w-6xl scroll-mt-24 px-6">
      <SectionHead
        eyebrow="What you get"
        title={
          <>
            Your real margin per{" "}
            {/* Solid colour: Chrome draws gradient-clipped text through opacity animations. */}
            <span className="rotator text-[#8b5cf6]">
              {["user", "plan", "trial", "model"].map((w, i) => (
                <span key={w} style={{ ["--i" as string]: i }}>
                  {w}
                </span>
              ))}
            </span>
          </>
        }
      />
      <Spotlight className="mt-12 grid auto-rows-[minmax(170px,auto)] gap-4 md:grid-cols-6">
        <Tile className="md:col-span-4" title="Margin per user" body="Revenue minus AI cost for every subscriber, worst first. Filter to paying users who cost more than they pay.">
          <div className="mt-5 space-y-2 font-mono text-xs">
            {[
              ["user_k3x9…", "paid", "−$16.41", "w-[92%] bg-red-400"],
              ["user_2b7q…", "paid", "−$4.08", "w-[40%] bg-red-300"],
              ["user_9m1c…", "trial", "−$0.34", "w-[12%] bg-amber-300"],
              ["user_p0aa…", "paid", "+$46.15", "w-[70%] bg-green-400"],
            ].map(([u, s, m, bar]) => (
              <div key={u} className="flex items-center gap-3">
                <span className="w-24 shrink-0">{u}</span>
                <span className="w-12 shrink-0 text-muted">{s}</span>
                <span className="h-1.5 flex-1 rounded-full bg-black/[0.04]">
                  <span className={`block h-1.5 rounded-full ${bar}`} />
                </span>
                <span className={`w-16 shrink-0 text-right ${m.startsWith("−") ? "text-red-600" : "text-green-600"}`}>{m}</span>
              </div>
            ))}
          </div>
        </Tile>
        <Tile className="md:col-span-2" title="Cost per trial" body="AI spent during free trials, per trial and per converted trial, by start week.">
          <div className="mt-5 flex items-end gap-1.5">
            {[40, 65, 52, 80, 58, 90, 70].map((h, i) => (
              <span key={i} className="w-full rounded-t bg-gradient-to-t from-[#6d5dfc] to-[#a855f7] opacity-80" style={{ height: `${h * 0.7}px` }} />
            ))}
          </div>
        </Tile>
        <Tile className="md:col-span-2" title="Plans that lose money" body="Each product's revenue, AI cost and margin, so you can price plans on real numbers." />
        <Tile className="md:col-span-2" title="Cost by model and feature" body="See whether chat, summaries or images drive the bill, and which model to switch." />
        <Tile className="md:col-span-2" title="Monday email" body="Last week's margin and the users and plans that lost money, in your inbox." />
        <Tile className="md:col-span-3" title="Accurate prices, your prices" body="List prices kept current, including cached tokens and long-prompt rates. Add negotiated discounts per provider or model." />
        <Tile className="md:col-span-3" title="Built for mobile subscriptions" body="Trials, renewals, refunds, upgrades and anonymous-to-logged-in users from RevenueCat, all handled." />
      </Spotlight>
    </section>
  );
}

function Tile({ className = "", title, body, children }: { className?: string; title: string; body: string; children?: ReactNode }) {
  return (
    <div className={`reveal card-glow spot flex flex-col rounded-2xl border border-black/5 bg-gradient-to-b from-white to-[#fafafc] p-6 ${className}`}>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
      {children}
    </div>
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

function CodeSection() {
  return (
    <section className="mx-auto mt-32 grid w-full max-w-6xl items-center gap-10 px-6 md:grid-cols-2">
      <div className="reveal">
        <p className="shimmer text-sm font-medium">For developers</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">One line per AI call</h2>
        <p className="mt-4 text-lg text-muted">
          Zero-dependency SDKs for TypeScript and Python with helpers for OpenAI, Anthropic and Gemini, streaming support, and a plain HTTP API for everything else.
        </p>
        <ul className="mt-6 space-y-2 text-sm">
          {[
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
        <Link href="/docs" className="mt-8 inline-block font-medium text-accent hover:underline">
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

function Privacy() {
  return (
    <section className="mx-auto mt-32 w-full max-w-6xl px-6">
      <div className="reveal relative overflow-hidden rounded-3xl border border-black/5 bg-gradient-to-br from-[#f5f3ff] via-white to-[#fdf2f8] p-10 md:p-14">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <p className="shimmer text-sm font-medium">Privacy by design</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Your users&apos; conversations never reach us</h2>
            <p className="mt-4 text-muted">
              The SDK sends counts, not content. No prompts, no responses, no names or emails: just an ID, a model and the number of tokens.
            </p>
          </div>
          <ul className="grid gap-3 text-sm">
            {[
              ["Counts, not content", "Token numbers and model names only."],
              ["90-day raw retention", "Raw events are deleted after 90 days; daily totals stay."],
              ["Delete anytime", "Remove an app's data in one click from Settings."],
              ["Hashed keys", "Ingest keys are stored as hashes, never in plain text."],
            ].map(([t, b]) => (
              <li key={t} className="glass rounded-xl border border-black/5 p-4">
                <div className="font-medium">{t}</div>
                <div className="text-muted">{b}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="mx-auto mt-32 w-full max-w-3xl px-6">
      <SectionHead eyebrow="FAQ" title="Questions, answered" />
      <div className="mt-10 divide-y divide-black/5 rounded-2xl border border-black/5 bg-white">
        {FAQ.map(([q, a]) => (
          <details key={q} className="reveal group px-6 py-5">
            <summary className="flex items-center justify-between gap-4 font-medium">
              {q}
              <span className="chev text-xl text-muted transition-transform">+</span>
            </summary>
            <p className="mt-3 text-sm text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto my-32 w-full max-w-6xl px-6">
      <div className="reveal relative isolate overflow-hidden rounded-3xl bg-[#0f0f1a] px-8 py-16 text-center text-white md:py-20">
        <div className="aurora aurora-dark" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <h2 className="relative text-3xl font-semibold tracking-tight sm:text-5xl">Stop guessing your AI margins.</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/70">Connect your backend and RevenueCat in ten minutes. Free during the beta.</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login" className="rounded-full bg-white px-6 py-3 font-medium text-[#0f0f1a] transition hover:-translate-y-0.5">
            Start free
          </Link>
          <Link href="/docs" className="rounded-full border border-white/20 px-6 py-3 font-medium transition hover:-translate-y-0.5 hover:bg-white/5">
            Read the docs
          </Link>
        </div>
      </div>
    </section>
  );
}
