import Link from "next/link";
import type { ReactNode } from "react";
import { CodeTabs, type CodeToken, Spotlight } from "@/components/fx";
import { DashboardPreview } from "@/components/dashboard-preview";
import { LogoMark } from "@/components/logo-mark";
import { FlowDemo } from "@/components/flow-demo";
import { CONTACT, SiteFooter, SiteHeader } from "@/components/site";

const RUNTIMES = ["Claude Code", "OpenAI", "Anthropic", "Gemini", "Groq", "OpenRouter", "fal.ai", "Cloudflare Workers", "Vercel", "Supabase", "Firebase", "Node.js", "Python", "FastAPI", "Django", "AWS Lambda", "Deno", "Bun", "RevenueCat"];

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

const FAQ: [string, string][] = [
  ["How do I see Claude Code spend per developer?", "Create an app in FiscaLLM, copy its key, and add five settings to Claude Code, as environment variables or in the settings file your admin distributes. Claude Code then reports each model call with the developer, the model, the tokens and the cost. There is no proxy and nothing to install."],
  ["Does FiscaLLM see our prompts or code?", "No. It reads one kind of event, the model call: the model, the token counts, Claude Code's cost figure and who made the call. Every other event Claude Code sends is discarded on arrival."],
  ["Doesn't Anthropic already show this?", "Partly. The Claude Console shows estimated spend per user for teams on API keys, and the Enterprise plan has cost by user and group. On the Team plan, and with Pro or Max seats, cost per developer comes from Claude Code's OpenTelemetry export, which needs somewhere to go. FiscaLLM is that place, with budget alerts."],
  ["We pay per seat (Pro, Max or Team). What does the cost mean?", "It is Claude Code's own estimate of what each call costs at API prices. On a subscription you pay per seat, so read it as what the usage would have cost on the API: good for comparing developers and teams and for deciding who needs a bigger plan, not a copy of your invoice."],
  ["Does it work with Cursor, Codex or GitHub Copilot?", "Codex CLI and Gemini CLI send their usage the same way Claude Code does, and Cursor is read with a team admin key. The OpenAI and Anthropic APIs are read with an admin key, and ElevenLabs, Perplexity and other AI APIs with one line of code. These new sources are in beta. GitHub Copilot and Windsurf are planned: vote on GitHub."],
  ["How big a team does the free hosted service cover?", "It accepts 1,000,000 events per app per month, and one model call is one event. An agent makes many model calls per task, so a large team can still pass that. Self-hosting is free and has no limit."],
  ["How do I give each plan its own AI limit?", "On the Limits page, add a row per plan: free, trial, paid or a product ID, with a number of AI calls or dollars per day, per month or in total. Your backend calls meter.check(userId) before each AI call. FiscaLLM knows the user's plan from RevenueCat or Stripe and answers with allow or refuse and how much is left."],
  ["Can my app show how many AI messages are left?", "Yes. Every check returns the limit, the amount used, the amount remaining and when it resets. Send it to your app to show \"3 left today\", and open your paywall when the answer is no."],
  ["How exact are the limits?", "Usage counts once a call is tracked, so calls made at the same moment can pass a limit by one or two. The SDK counts each tracked call at once, and the server follows within seconds. It is built for plan allowances and paywalls, not for billing by the unit."],
  ["What does FiscaLLM store?", "User IDs, token counts, models, cost and, for a product, your revenue events (RevenueCat or Stripe). Never prompts or responses."],
  ["Who is it for?", "Engineering teams that want to see Claude Code spend per developer, and subscription apps that call AI from their own backend, in TypeScript or Python."],
  ["I already use OpenTelemetry, LiteLLM or the Vercel AI SDK. Do I need another SDK?", "No. Point an OpenTelemetry trace exporter at FiscaLLM, or add one callback to your LiteLLM config, and the usage you already record becomes cost per user. The SDK is for apps that have neither."],
  ["Can an AI agent use it?", "Yes. A read-only MCP server at fiscallm.com/api/mcp gives assistants current LLM prices and cost estimates with no key, and your app's cost and margin per user with its key. The same data is a JSON API."],
  ["Do I need RevenueCat?", "No. Connect RevenueCat in one click, or Stripe with one webhook, or upload a CSV from Paddle, Lemon Squeezy or a spreadsheet, or send payments with one SDK call."],
  ["Does it include revenue from before I connected?", "Yes. Connect RevenueCat imports past subscribers, the Stripe import brings in the last 12 months with a read-only key that is never stored, and a CSV upload covers anything else. Re-running an import never counts a payment twice."],
  ["What if FiscaLLM is down?", "Your app is unaffected. Reporting happens in the background and never blocks a request, and the optional budget check lets calls through, except for users it already refused. You can make it refuse instead, and add a local limit that stops runaway loops with no network at all."],
  ["Can it stop a user who goes over budget?", "Yes, if you want it to. Mark a per-user budget as Block, and call meter.check(userId) before an AI call: it says no once the user reaches the amount, and you refuse them or switch to a cheaper model. Alerts alone never block anything."],
  ["I charge per job (credits), not per month. Does it fit?", "Yes. Tag each AI call with your job id and report whether the user's credits were captured or refunded. The Jobs page shows the AI cost of refunded jobs and of jobs that never resolved, per user."],
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
      sameAs: [
        "https://github.com/magna56/fiscallm",
        "https://www.npmjs.com/package/fiscallm",
        "https://pypi.org/project/fiscallm/",
        "https://www.producthunt.com/products/fiscallm",
        "https://www.linkedin.com/in/mayur-agnani/",
      ],
    },
    {
      "@type": "SoftwareApplication",
      name: "FiscaLLM",
      url: "https://fiscallm.com",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      description: "Shows what each developer and team spends on AI tools (Claude Code, Codex, Cursor, Gemini CLI, the OpenAI and Anthropic APIs), with budget alerts and no proxy. For AI products, limits AI usage by subscription plan and shows each user's AI cost against what they pay.",
      featureList: [
        "AI spend per developer, team, tool and model: Claude Code, Codex CLI, Gemini CLI, Cursor, the OpenAI and Anthropic APIs",
        "Budget alerts per developer and a warning when an agent loops",
        "No proxy or wrapper; prompts and code are never stored",
        "AI usage limits per free, trial and paid plan, in AI calls or dollars, per day, month or in total",
        "Remaining allowance for every user, for in-app counters and paywalls",
        "Plans read from RevenueCat or Stripe",
        "AI cost per user, plan and free trial next to revenue",
        "Usage from OpenTelemetry traces, LiteLLM, the Vercel AI SDK, or TypeScript and Python SDKs",
        "Revenue from RevenueCat, Stripe, CSV or an API",
        "Alerts and per-user spending caps",
        "MCP server and JSON API for AI agents",
        "Free LLM pricing API",
      ],
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
        <ClaudeCode />
        <Already />
        <Products />
        <PlanLimits />
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
          href="/integrations/claude-code"
          className="fade-up glass inline-flex items-center gap-2 rounded-full border border-black/5 px-3 py-1 text-xs text-muted shadow-sm"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Free and open source<span className="hidden sm:inline"> · No proxy, nothing to install</span>
          <span aria-hidden>→</span>
        </Link>

        <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl">
          <Words text="See what every developer" start={0} /> <Words text="spends on AI." start={4} gradient />
        </h1>
        <p className="fade-up delay-2 mt-6 max-w-2xl text-lg text-muted sm:text-xl">
          Claude Code, Codex, Cursor, Gemini CLI and the OpenAI and Anthropic APIs, per developer, tool and model on one page. Budget alerts and a warning
          when an agent loops. Turn on the tools you use. No proxy, and prompts are never stored.
        </p>
        <div className="fade-up delay-3 mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="btn-glow rounded-full bg-foreground px-6 py-3 font-medium text-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            Start free
          </Link>
          <Link href="/integrations/claude-code" className="glass rounded-full border border-black/10 px-6 py-3 font-medium transition hover:-translate-y-0.5">
            See the setup
          </Link>
        </div>
        <p className="fade-up delay-3 mt-4 text-sm text-muted">5-minute setup · Only the model, tokens and cost are stored</p>

        <div className="relative mt-16 w-full max-w-5xl">
          <div className="glow" aria-hidden />
          <div className="product-frame relative overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl shadow-indigo-500/10">
            <div className="flex items-center gap-2 border-b border-black/5 bg-[#fafafc] px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="mx-auto rounded-md bg-black/[0.04] px-3 py-0.5 text-xs text-muted">fiscallm.com/dashboard</span>
            </div>
            <ClaudeCodePreview />
          </div>

          <FloatCard className="float -left-48 top-[16%] hidden xl:block">
            <div className="text-xs text-muted">Budget alert · Slack</div>
            <div className="mt-1 font-mono text-sm">alice · $52.10 today</div>
            <div className="mt-2 h-1.5 w-40 rounded-full bg-black/[0.05]">
              <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-[#6d5dfc] to-[#ec4899]" />
            </div>
            <div className="mt-1 text-xs text-muted">over the $50 daily budget</div>
          </FloatCard>
          <FloatCard className="float-slow -right-44 top-[46%] hidden xl:block">
            <div className="text-xs text-muted">Runaway session</div>
            <div className="mt-1 flex items-center justify-between gap-6 font-mono text-sm">
              <span>ben</span>
              <span className="font-semibold text-red-600">3.1M tokens</span>
            </div>
            <div className="mt-1 text-xs text-muted">in 5 minutes · alert sent</div>
          </FloatCard>
        </div>
      </div>
    </section>
  );
}

// Sample numbers for the hero: one team's Claude Code usage over 30 days.
const DEVS: [string, string, number, number][] = [
  ["alice@example.com", "platform", 2310, 412.6],
  ["ben@example.com", "platform", 1804, 268.15],
  ["chen@example.com", "mobile", 1522, 201.4],
  ["dana@example.com", "mobile", 1190, 148.9],
  ["eli@example.com", "data", 1034, 119.75],
  ["farah@example.com", "data", 870, 77.3],
  ["gus@example.com", "platform", 452, 38.2],
  ["hana@example.com", "mobile", 230, 17.9],
];

/** The hero's product shot: the spend-only dashboard a Claude Code team sees, on sample data. */
function ClaudeCodePreview() {
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const total = DEVS.reduce((t, d) => t + d[3], 0);
  const calls = DEVS.reduce((t, d) => t + d[2], 0);
  const teams = [...new Set(DEVS.map((d) => d[1]))]
    .map((team): [string, number] => [team, DEVS.filter((d) => d[1] === team).reduce((t, d) => t + d[3], 0)])
    .sort((x, y) => y[1] - x[1]);
  const stats: [string, string, string][] = [
    ["AI cost", money(total), `${calls.toLocaleString("en-US")} model calls`],
    ["Developers", String(DEVS.length), "with usage"],
    ["Cost per developer", money(total / DEVS.length), "last 30 days"],
  ];
  return (
    <div className="select-none bg-[#f7f7fb] p-4 text-left sm:p-5" aria-label="Example FiscaLLM dashboard for a team's Claude Code spend, on sample data">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold tracking-tight">Claude Code · Engineering</p>
          <p className="mt-0.5 text-xs text-black/50">Last 30 days</p>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">Sample data</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {stats.map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl border border-black/[0.06] bg-white p-3 sm:p-4">
            <div className="text-xs font-medium text-muted">{label}</div>
            <div className="mt-1 text-base font-semibold tracking-tight tabular-nums sm:text-xl">{value}</div>
            <div className="mt-1 hidden text-xs text-black/45 sm:block">{hint}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
          <p className="text-sm font-semibold">Developers, biggest spend first</p>
          <ul className="mt-3 space-y-2.5 text-xs">
            {DEVS.slice(0, 6).map(([email, team, n, cost]) => (
              <li key={email}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-mono">{email}</span>
                  <span className="shrink-0 tabular-nums">
                    <span className="hidden text-black/45 sm:inline">
                      {team} · {n.toLocaleString("en-US")} calls ·{" "}
                    </span>
                    <span className="font-medium">{money(cost)}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-black/[0.05]">
                  <div className="h-1.5 rounded bg-[#6d5dfc]/70" style={{ width: `${(cost / DEVS[0][3]) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="hidden rounded-2xl border border-black/[0.06] bg-white p-4 md:block">
          <p className="text-sm font-semibold">Cost by team</p>
          <ul className="mt-3 space-y-2.5 text-xs">
            {teams.map(([team, cost]) => (
              <li key={team}>
                <div className="flex justify-between">
                  <span className="font-mono">{team}</span>
                  <span className="tabular-nums">{money(cost)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded bg-black/[0.05]">
                  <div className="h-1.5 rounded bg-black/40" style={{ width: `${(cost / total) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-black/5 pt-3 text-xs text-black/50">
            Cost is Claude Code&apos;s own estimate at API prices.
          </p>
        </div>
      </div>
    </div>
  );
}

const CC_SETTINGS = `{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_LOGS_PROTOCOL": "http/json",
    "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT":
      "https://fiscallm.com/api/v1/otel/v1/logs",
    "OTEL_EXPORTER_OTLP_LOGS_HEADERS":
      "Authorization=Bearer <FISCALLM_KEY>"
  }
}`;

function ClaudeCode() {
  const get: [string, string][] = [
    ["Spend per developer", "Model calls and cost for each person, biggest first, with a CSV export."],
    ["Spend per team", "Add team.id to the settings and cost is grouped by team."],
    ["Budget alerts", "Email or Slack when a developer passes an amount in a day or in 30 days, or the whole team passes a daily amount."],
    ["Runaway warning", "An alert when someone uses more tokens in 5 minutes than you allow, which is how a looping agent shows up."],
    ["Ask Claude", "The same numbers through an MCP server and a JSON API, so you can ask who spent the most this week."],
  ];
  const points: [string, string][] = [
    ["Nothing in the request path", "Claude Code talks to Anthropic as before and reports usage on the side. If FiscaLLM is down, nobody notices."],
    ["Counts, not code", "Only the model-call event is read: the model, the tokens, the cost and who. Prompts, code and tool output are never stored."],
    ["Yours to run", "MIT licensed. Try it on the free hosted service; self-host for a larger team, with no limit."],
  ];
  return (
    <section id="claude-code" className="mx-auto mt-28 w-full max-w-6xl scroll-mt-24 px-6">
      <SectionHead
        eyebrow="How it works"
        title={
          <>
            Five settings. <span className="text-gradient">No proxy.</span>
          </>
        }
        body="Claude Code, Codex and Gemini CLI already export their usage with OpenTelemetry, and Cursor and the OpenAI and Anthropic APIs are read with one key. FiscaLLM puts it on one page."
      />
      <div className="reveal mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2">
        <div className="card-glow spot rounded-2xl border border-black/5 bg-white p-6">
          <h3 className="font-semibold">1. Add this to Claude Code&apos;s settings</h3>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-[#0f0f1a] p-4 text-xs leading-relaxed text-white/90">
            <code>{CC_SETTINGS}</code>
          </pre>
          <p className="mt-3 text-xs text-muted">
            In the managed settings your admin distributes, or each developer&apos;s <code>~/.claude/settings.json</code>. Environment variables work too.
          </p>
        </div>
        <div className="card-glow spot rounded-2xl border border-black/5 bg-white p-6">
          <h3 className="font-semibold">2. See who spends what</h3>
          <ul className="mt-4 divide-y divide-black/5 text-sm">
            {get.map(([t, b]) => (
              <li key={t} className="py-2.5">
                <strong>{t}.</strong> <span className="text-muted">{b}</span>
              </li>
            ))}
          </ul>
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
        <Link href="/integrations/claude-code" className="font-medium text-accent hover:underline">
          Full setup: teams, names and what is stored →
        </Link>
      </p>
    </section>
  );
}

function Already() {
  const rows: [string, string, string][] = [
    ["API keys, in the Claude Console", "The Console has a Claude Code page with estimated spend per user.", "Start there. FiscaLLM adds alerts per developer and your own team grouping."],
    ["Enterprise plan", "An admin dashboard with usage and cost by group and by user, with spend limits.", "You probably don't need FiscaLLM."],
    ["Team plan", "The analytics dashboard shows usage and contribution, not cost per developer. Cost comes from the OpenTelemetry export or a CSV spend report.", "This is where FiscaLLM helps: a place to send that export, with no collector or Grafana to run."],
    ["Pro or Max seats, one per developer", "Each seat is its own account, so there is no shared view.", "FiscaLLM puts the team on one page."],
    ["Only you", "The /cost command, or a local tool such as ccusage.", "Use those. They are free and need no account."],
    ["Amazon Bedrock or Google Vertex AI", "The same OpenTelemetry export.", "Not tested with FiscaLLM yet. If you try it, tell us what you see."],
  ];
  return (
    <section id="already" className="mx-auto mt-28 w-full max-w-6xl scroll-mt-24 px-6">
      <SectionHead
        eyebrow="Before you sign up"
        title={
          <>
            What Anthropic <span className="text-gradient">already gives you</span>
          </>
        }
        body="You may not need this. It depends on how your team pays for Claude Code."
      />
      <div className="reveal mx-auto mt-10 max-w-5xl overflow-x-auto rounded-2xl border border-black/5 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-black/5 text-xs text-muted">
              <th className="px-5 py-3 font-medium">You use</th>
              <th className="px-5 py-3 font-medium">What you get without FiscaLLM</th>
              <th className="px-5 py-3 font-medium">Our advice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map(([use, have, advice]) => (
              <tr key={use} className="align-top">
                <td className="px-5 py-3.5 font-medium">{use}</td>
                <td className="px-5 py-3.5 text-muted">{have}</td>
                <td className="px-5 py-3.5">{advice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-center text-xs text-muted">
        As of November 2026. Plans change, so check{" "}
        <a href="https://code.claude.com/docs/en/analytics" className="underline hover:text-foreground">
          Anthropic&apos;s analytics documentation
        </a>
        . FiscaLLM is not affiliated with Anthropic.
      </p>
    </section>
  );
}

function Products() {
  return (
    <section id="products" className="mx-auto mt-32 w-full max-w-6xl scroll-mt-24 px-6">
      <div className="reveal rounded-3xl border border-black/5 bg-gradient-to-br from-[#f5f3ff] via-white to-[#fdf2f8] p-8 text-center md:p-12">
        <p className="shimmer text-sm font-medium">Building an AI product?</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          The same meter, <span className="text-gradient">for your own users</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted">
          FiscaLLM also counts what each user of your app costs you in AI, limits it by plan, and sets it next to what they pay. Works with
          RevenueCat, Stripe or a CSV.
        </p>
        <Link
          href="/demo"
          aria-label="Open the live demo dashboard"
          className="product-frame group relative mx-auto mt-8 block max-w-4xl overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl shadow-indigo-500/10 transition hover:-translate-y-0.5"
        >
          <DashboardPreview />
          <span className="absolute bottom-3 right-3 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-white shadow-md transition group-hover:scale-105 sm:text-sm">
            Try it live →
          </span>
        </Link>
      </div>
    </section>
  );
}

function PlanLimits() {
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
      <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-muted">
        Works with your stack ·{" "}
        <Link href="/integrations" className="normal-case tracking-normal text-accent hover:underline">
          see all integrations
        </Link>
      </p>
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

function Solution() {
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

function Actions() {
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

function HowItWorks() {
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

function Privacy() {
  return (
    <section className="mx-auto mt-28 w-full max-w-6xl px-6">
      <div className="reveal flex flex-col items-start justify-between gap-6 rounded-3xl border border-black/5 bg-gradient-to-br from-[#f5f3ff] via-white to-[#fdf2f8] p-8 md:flex-row md:items-center md:p-10">
        <div>
          <p className="shimmer text-sm font-medium">Privacy by design</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Counts, not conversations</h2>
          <p className="mt-2 max-w-xl text-muted">
            Only an ID for the person, the model, token counts and cost are stored. Never prompts, code or responses. Delete any app&apos;s data
            in one click.
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
        <h2 className="relative text-3xl font-semibold tracking-tight sm:text-5xl">Know who spends what on AI.</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/70">Five settings and about five minutes. Free and open source.</p>
        <p className="relative mx-auto mt-3 max-w-xl text-sm text-white/55">
          We&apos;re looking for our first 10 teams. Tell us which AI tools your team uses and we&apos;ll help you set it up, or star it on <a href="https://github.com/magna56/fiscallm" className="text-white underline underline-offset-4">GitHub</a>. Questions:{" "}
          <a href={`mailto:${CONTACT}`} className="text-white underline underline-offset-4">
            {CONTACT}
          </a>
        </p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login" className="rounded-full bg-white px-6 py-3 font-medium text-[#0f0f1a] transition hover:-translate-y-0.5">
            Start free
          </Link>
          <Link href="/integrations/claude-code" className="rounded-full border border-white/20 px-6 py-3 font-medium transition hover:-translate-y-0.5 hover:bg-white/5">
            See the setup
          </Link>
        </div>
      </div>
    </section>
  );
}
