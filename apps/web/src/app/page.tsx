import Link from "next/link";
import type { ReactNode } from "react";
import { CodeTabs, type CodeToken, Spotlight } from "@/components/fx";
import { DashboardPreview } from "@/components/dashboard-preview";
import { LogoMark } from "@/components/logo-mark";
import { FlowDemo } from "@/components/flow-demo";
import { CONTACT, SiteFooter, SiteHeader } from "@/components/site";

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
  ["What does FiscaLLM store?", "User IDs, token counts, models and RevenueCat events. Never prompts or responses."],
  ["Which apps is it for?", "Subscription apps that call AI from their own backend, in TypeScript or Python."],
  ["Do I need RevenueCat?", "No. RevenueCat connects with one webhook, but you can also send payments from Stripe or any billing system with one SDK call."],
  ["What if FiscaLLM is down?", "Your app is unaffected. Reporting happens in the background and never blocks a request."],
  ["What does it cost?", "Nothing. FiscaLLM is open source (MIT). Use the free hosted service, or run your own copy."],
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://fiscallm.com/#org",
      name: "FiscaLLM",
      url: "https://fiscallm.com",
      logo: "https://fiscallm.com/icon.svg",
      email: CONTACT,
      sameAs: ["https://github.com/magna56/fiscallm", "https://www.linkedin.com/in/mayur-agnani/"],
    },
    {
      "@type": "SoftwareApplication",
      name: "FiscaLLM",
      url: "https://fiscallm.com",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      description: "Matches each user's AI cost to what they pay you, so you can see margin per user, plan and free trial.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      license: "https://opensource.org/licenses/MIT",
      codeRepository: "https://github.com/magna56/fiscallm",
      publisher: { "@id": "https://fiscallm.com/#org" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ],
};

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col overflow-x-clip">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <SiteHeader />
      <main className="flex flex-col">
        <Hero />
        <Problem />
        <Solution />
        <HowItWorks />
        <Actions />
        <Runtimes />
        <CodeSection />
        <Privacy />
        <Faq />
        <BuiltBy />
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
          Free and open source<span className="hidden sm:inline"> · SDKs for TypeScript &amp; Python</span>
          <span aria-hidden>→</span>
        </Link>

        <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl">
          <Words text="See the AI cost of" start={0} /> <Words text="every single user." start={5} gradient />
        </h1>
        <p className="fade-up delay-2 mt-6 max-w-2xl text-lg text-muted sm:text-xl">
          FiscaLLM matches every user&apos;s AI cost to what they pay you.
        </p>
        <div className="fade-up delay-3 mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="btn-glow rounded-full bg-foreground px-6 py-3 font-medium text-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Start free
          </Link>
          <Link href="/demo" className="glass rounded-full border border-black/10 px-6 py-3 font-medium transition hover:-translate-y-0.5">
            View live demo
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
  const points: [string, string][] = [
    ["Flat price, variable cost", "Everyone pays $9.99. One user costs you $0.20 in AI, another $25."],
    ["Two bills that never meet", "Your AI bill shows tokens. RevenueCat shows payments. Neither shows the user."],
    ["You find out too late", "All you see is one big AI bill at the end of the month."],
  ];
  return (
    <section id="problem" className="mx-auto mt-28 w-full max-w-6xl scroll-mt-24 px-6">
      <SectionHead
        eyebrow="The problem"
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
    </section>
  );
}

function Solution() {
  const points: [string, string][] = [
    ["Joins cost and revenue, per user", "One line in your backend reports AI usage. One RevenueCat webhook reports payments."],
    ["Shows your real margin", "Per user, per plan, per free trial, and which model or feature drives the bill."],
    ["Warns you early", "Alerts and a webhook when a user or the app goes over your budget."],
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

function Actions() {
  const actions: [string, string][] = [
    ["Price plans on real numbers", "See which plan loses money once AI is paid for."],
    ["Cap heavy users", "A budget per user, and a webhook so your backend can slow them down."],
    ["Switch the expensive feature", "Find the feature and model behind the bill; move it to a cheaper model."],
    ["Fix trials that don't pay off", "Know what each trial and each conversion costs."],
    ["Get alerts the same day", "By email or webhook, when a user or the app goes over your line."],
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

function HowItWorks() {
  return (
    <section id="how" className="mx-auto mt-32 w-full max-w-6xl scroll-mt-24 px-6">
      <SectionHead eyebrow="How it works" title="Watch one request" body="Nothing sits between your app and the AI. Usage and revenue are reported on the side." />
      <div className="reveal mt-12">
        <FlowDemo />
      </div>
      <p className="mt-6 text-center text-sm">
        <Link href="/how-it-works" className="font-medium text-accent hover:underline">
          Engineer? See exactly how it works →
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

function CodeSection() {
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
    <section className="mx-auto mt-28 w-full max-w-6xl px-6">
      <div className="reveal flex flex-col items-start justify-between gap-6 rounded-3xl border border-black/5 bg-gradient-to-br from-[#f5f3ff] via-white to-[#fdf2f8] p-8 md:flex-row md:items-center md:p-10">
        <div>
          <p className="shimmer text-sm font-medium">Privacy by design</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Counts, not conversations</h2>
          <p className="mt-2 max-w-xl text-muted">
            Only a user ID, the model and token counts leave your backend. Never prompts or responses. Delete any app&apos;s data in one click.
          </p>
        </div>
        <a href="/privacy" className="shrink-0 font-medium text-accent hover:underline">
          Privacy policy →
        </a>
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

function BuiltBy() {
  return (
    <section className="mx-auto mt-24 w-full max-w-3xl px-6">
      <div className="reveal flex flex-col items-center gap-4 rounded-3xl border border-black/5 bg-white p-8 text-center sm:flex-row sm:text-left">
        <LogoMark className="h-14 w-14 shrink-0" />
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Built by{" "}
            <a href="https://www.linkedin.com/in/mayur-agnani/" rel="noopener" className="text-accent hover:underline">
              Mayur
            </a>
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            FiscaLLM is an independent, open-source side project, written and maintained by one person. The code is MIT licensed and public, so you can read
            exactly what runs in your backend, or host it yourself. Questions, bugs and ideas are welcome:{" "}
            <a href={`mailto:${CONTACT}`} className="text-accent underline">
              {CONTACT}
            </a>{" "}
            or <a href="https://github.com/magna56/fiscallm/issues" className="text-accent underline">GitHub issues</a>.
          </p>
        </div>
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
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/70">Connect your backend and RevenueCat in ten minutes. Free and open source.</p>
        <p className="relative mx-auto mt-3 max-w-xl text-sm text-white/55">
          We&apos;re looking for our first 10 apps. Tell us what you build and we&apos;ll help you set it up, or star it on <a href="https://github.com/magna56/fiscallm" className="text-white underline underline-offset-4">GitHub</a>. Questions:{" "}
          <a href={`mailto:${CONTACT}`} className="text-white underline underline-offset-4">
            {CONTACT}
          </a>
        </p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login" className="rounded-full bg-white px-6 py-3 font-medium text-[#0f0f1a] transition hover:-translate-y-0.5">
            Start free
          </Link>
          <Link href="/demo" className="rounded-full border border-white/20 px-6 py-3 font-medium transition hover:-translate-y-0.5 hover:bg-white/5">
            View live demo
          </Link>
        </div>
      </div>
    </section>
  );
}
