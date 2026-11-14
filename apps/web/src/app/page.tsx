import Link from "next/link";
import { SectionHead } from "@/components/app-sections";
import { CopyButton } from "@/components/copy-button";
import { Spotlight } from "@/components/fx";
import { LogoMark } from "@/components/logo-mark";
import { CONTACT, SiteFooter, SiteHeader } from "@/components/site";

const RUNTIMES = ["Claude Code", "OpenAI", "Anthropic", "Gemini", "Groq", "OpenRouter", "fal.ai", "Cloudflare Workers", "Vercel", "Supabase", "Firebase", "Node.js", "Python", "FastAPI", "Django", "AWS Lambda", "Deno", "Bun", "RevenueCat"];


const FAQ: [string, string][] = [
  ["What does npx fiscallm do?", "It reads the usage logs Claude Code and Codex CLI already write on your machine (~/.claude/projects and ~/.codex/sessions) and prints what the usage cost at API list prices, by tool, model, project and day. It needs no account and makes no network request. Add --by day, --days 7 or --json."],
  ["Is it really free?", "Yes. Everything is MIT licensed and there are no paid plans. The hosted dashboard is free under fair use (1,000,000 events per app per month), and you can host every part yourself."],
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
  ["Who is it for?", "Any developer who wants to know what their AI coding costs (the command line tool), engineering teams that want spend per developer across tools (the dashboard), and apps that call AI from their own backend (cost per user and limits by plan)."],
  ["I already use OpenTelemetry, LiteLLM or the Vercel AI SDK. Do I need another SDK?", "No. Point an OpenTelemetry trace exporter at FiscaLLM, or add one callback to your LiteLLM config, and the usage you already record becomes cost per user. The SDK is for apps that have neither."],
  ["Can an AI agent use it?", "Yes. A read-only MCP server at fiscallm.com/api/mcp gives assistants current LLM prices and cost estimates with no key, and your app's cost and margin per user with its key. The same data is a JSON API."],
  ["Do I need RevenueCat?", "No. Connect RevenueCat in one click, or Stripe with one webhook, or upload a CSV from Paddle, Lemon Squeezy or a spreadsheet, or send payments with one SDK call."],
  ["Does it include revenue from before I connected?", "Yes. Connect RevenueCat imports past subscribers, the Stripe import brings in the last 12 months with a read-only key that is never stored, and a CSV upload covers anything else. Re-running an import never counts a payment twice."],
  ["What if FiscaLLM is down?", "Your app is unaffected. Reporting happens in the background and never blocks a request, and the optional budget check lets calls through, except for users it already refused. You can make it refuse instead, and add a local limit that stops runaway loops with no network at all."],
  ["Can it stop a user who goes over budget?", "Yes, if you want it to. Mark a per-user budget as Block, and call meter.check(userId) before an AI call: it says no once the user reaches the amount, and you refuse them or switch to a cheaper model. Alerts alone never block anything."],
  ["I charge per job (credits), not per month. Does it fit?", "Yes. Tag each AI call with your job id and report whether the user's credits were captured or refunded. The Jobs page shows the AI cost of refunded jobs and of jobs that never resolved, per user."],
  ["What does it cost?", "Nothing, and there are no paid plans. FiscaLLM is open source (MIT). Use the free hosted service, or run your own copy."],
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
        <Tools />
        <ClaudeCode />
        <Already />
        <Runtimes />
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
          href="https://github.com/magna56/fiscallm"
          className="fade-up glass inline-flex items-center gap-2 rounded-full border border-black/5 px-3 py-1 text-xs text-muted shadow-sm"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Free and open source, MIT<span className="hidden sm:inline"> · No paid plans</span>
          <span aria-hidden>→</span>
        </Link>

        <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl md:text-7xl">
          <Words text="Know what your AI" start={0} /> <Words text="really costs." start={4} gradient />
        </h1>
        <p className="fade-up delay-2 mt-6 max-w-2xl text-lg text-muted sm:text-xl">
          Free, open-source tools for developers. Start on your own machine with one command and no account. Then put your whole team on one page,
          across Claude Code, Codex, Cursor and Gemini CLI, or see what each user of your app costs you.
        </p>
        <div className="fade-up delay-3 mt-8 flex items-center gap-3 rounded-full border border-black/10 bg-[#0f0f1a] py-2 pl-5 pr-2 font-mono text-sm text-white shadow-lg shadow-black/10">
          <span>
            <span className="text-white/40">$ </span>npx fiscallm
          </span>
          <span className="rounded-full bg-white text-[#0f0f1a]">
            <CopyButton value="npx fiscallm" />
          </span>
        </div>
        <p className="fade-up delay-3 mt-4 text-sm text-muted">
          What Claude Code and Codex cost you, from the logs on your machine. Nothing is sent anywhere.
        </p>

        <div className="relative mt-16 w-full max-w-5xl">
          <div className="glow" aria-hidden />
          <div className="product-frame relative overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl shadow-indigo-500/10">
            <div className="flex items-center gap-2 border-b border-black/5 bg-[#fafafc] px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="mx-auto rounded-md bg-black/[0.04] px-3 py-0.5 text-xs text-muted">Terminal · sample output</span>
            </div>
            <pre className="overflow-x-auto bg-[#0f0f1a] p-5 text-left font-mono text-[11px] leading-relaxed text-white/85 sm:text-xs">
              <code>{TERMINAL}</code>
            </pre>
          </div>

        </div>
      </div>
    </section>
  );
}

// Sample output of `npx fiscallm`, in the format bin/fiscallm.mjs prints.
const TERMINAL = `$ npx fiscallm
AI coding spend, last 30 days: $412.60 over 5,931 model calls (1.2B tokens)

Tool            calls    tokens         cost
Claude Code      4810    988.1M      $351.92
Codex            1121    214.6M       $60.68

Model                 calls    tokens         cost
claude-opus-5-5        3102    731.4M      $298.40
claude-sonnet-5-5      1708    256.7M       $53.52
gpt-5.3-codex          1121    214.6M       $60.68

Project                  calls    tokens         cost
api (Claude Code)         2210    463.0M      $171.33
mobile (Claude Code)      1534    301.2M      $112.04
web (Codex)                801    150.9M       $41.10
…

At API list prices. On a subscription plan you pay the plan, not this.`;

function Tools() {
  const tools: { tag: string; title: string; body: string; code: string; href: string; link: string }[] = [
    {
      tag: "On your machine",
      title: "What your AI coding costs you",
      body: "Reads the logs Claude Code and Codex CLI already keep. Cost by day, model and project. No account, and nothing leaves your laptop.",
      code: "npx fiscallm",
      href: "https://github.com/magna56/fiscallm/tree/main/packages/sdk#command-line",
      link: "How it works",
    },
    {
      tag: "For your team",
      title: "Every developer, every AI tool",
      body: "Claude Code, Codex and Gemini CLI report on their own; Cursor and the OpenAI and Anthropic APIs are read with an admin key. Budget alerts and a warning when an agent loops.",
      code: "Sources → turn on the tools you use",
      href: "/integrations/claude-code",
      link: "Set up a team",
    },
    {
      tag: "For your app",
      title: "What each user costs you",
      body: "One line after each AI call in your backend. AI cost per user against what they pay, limits per free and paid plan, and alerts.",
      code: "meter.check(userId)  →  3 left today",
      href: "/for-apps",
      link: "For apps",
    },
    {
      tag: "For anyone",
      title: "LLM prices, free API and MCP",
      body: "Current prices for OpenAI, Anthropic and Google models as a page, a JSON API with no key, an MCP server for assistants, and a price table in the SDK.",
      code: "GET /api/v1/prices/claude-opus-5-5",
      href: "/llm-pricing",
      link: "LLM prices",
    },
  ];
  return (
    <section id="tools" className="mx-auto mt-28 w-full max-w-6xl scroll-mt-24 px-6">
      <SectionHead
        eyebrow="Free and open source"
        title={
          <>
            Four tools, <span className="text-gradient">one price table</span>
          </>
        }
        body="Use one or all of them. MIT licensed, no paid plans, and you can host every part yourself."
      />
      <Spotlight className="mt-10 grid gap-4 md:grid-cols-2">
        {tools.map((t) => (
          <Link key={t.tag} href={t.href} className="reveal card-glow spot group flex flex-col rounded-2xl border border-black/5 bg-white p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-accent">{t.tag}</p>
            <h3 className="mt-2 text-lg font-semibold">{t.title}</h3>
            <p className="mt-1.5 flex-1 text-sm text-muted">{t.body}</p>
            <code className="mt-4 block truncate rounded-lg bg-[#fafafc] px-3 py-2 font-mono text-xs text-foreground/70">{t.code}</code>
            <span className="mt-3 text-sm font-medium text-accent group-hover:underline">{t.link} →</span>
          </Link>
        ))}
      </Spotlight>
    </section>
  );
}

// Sample numbers for the team section: one team's Claude Code usage over 30 days.
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
        eyebrow="For your team"
        title={
          <>
            Five settings. <span className="text-gradient">No proxy.</span>
          </>
        }
        body="Claude Code, Codex and Gemini CLI already export their usage with OpenTelemetry, and Cursor and the OpenAI and Anthropic APIs are read with one key. FiscaLLM puts it on one page."
      />
      <div className="reveal mx-auto mt-10 max-w-5xl overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl shadow-indigo-500/10">
        <ClaudeCodePreview />
      </div>
      <div className="reveal mx-auto mt-4 grid max-w-5xl gap-4 md:grid-cols-2">
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
        <h2 className="relative text-3xl font-semibold tracking-tight sm:text-5xl">Know what your AI really costs.</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/70">
          Start with <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-base">npx fiscallm</code>. Free and open source, with no paid plans.
        </p>
        <p className="relative mx-auto mt-3 max-w-xl text-sm text-white/55">
          We&apos;re looking for our first 10 teams. Tell us which AI tools your team uses and we&apos;ll help you set it up, or star it on <a href="https://github.com/magna56/fiscallm" className="text-white underline underline-offset-4">GitHub</a>. Questions:{" "}
          <a href={`mailto:${CONTACT}`} className="text-white underline underline-offset-4">
            {CONTACT}
          </a>
        </p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login" className="rounded-full bg-white px-6 py-3 font-medium text-[#0f0f1a] transition hover:-translate-y-0.5">
            Team dashboard, free
          </Link>
          <a href="https://github.com/magna56/fiscallm" className="rounded-full border border-white/20 px-6 py-3 font-medium transition hover:-translate-y-0.5 hover:bg-white/5">
            Star on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
