import type { Metadata } from "next";
import Link from "next/link";
import { SectionHead } from "@/components/app-sections";
import { CopyButton } from "@/components/copy-button";
import { LogoMark } from "@/components/logo-mark";
import { CONTACT, SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = {
  title: "What your AI coding costs · FiscaLLM for teams",
  description:
    "Open-source cost tracker for Claude Code, Codex, Cursor and Gemini CLI. npx fiscallm reads your local logs with no account; a free team dashboard shows spend per developer.",
  alternates: { canonical: "/for-teams" },
};

const FAQ: [string, string][] = [
  ["What does npx fiscallm do?", "It reads the usage logs Claude Code and Codex CLI already write on your machine (~/.claude/projects and ~/.codex/sessions) and prints what the usage cost at API list prices, by tool, model, project and day. It needs no account and makes no network request. Add --by day, --days 7 or --json."],
  ["We pay per seat (Pro, Max or Team). What does the cost mean?", "It is what each call would cost at API list prices. On a subscription you pay per seat, so read it as what the usage would have cost on the API: good for comparing developers and projects and for deciding who needs a bigger plan, not a copy of your invoice."],
  ["How do I see the whole team?", "Create a free team app, copy its key, and add five settings to Claude Code, Codex or Gemini CLI, in the settings file your admin distributes or as environment variables. Each tool then reports its model calls with the developer, the model and the tokens. Cursor is read with a team admin key. No proxy and nothing to install."],
  ["Does it see our prompts or code?", "No. The command line tool reads only usage numbers and sends nothing. The team dashboard keeps only the model-call event: the model, the token counts, the cost and who made the call. Every other event is discarded on arrival."],
  ["Doesn't Anthropic already show this?", "Partly. The Claude Console shows estimated spend per user for teams on API keys, and the Enterprise plan has cost by user and group. On the Team plan and with Pro or Max seats there is no per-developer cost view, and none of them covers Codex, Cursor or Gemini CLI next to Claude Code."],
  ["Is it really free?", "Yes. Everything is MIT licensed and there are no paid plans. The hosted team dashboard is free under fair use (1,000,000 model calls per month), and you can host it yourself with no limit."],
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
      description: "Open-source tracker for what AI coding tools cost: npx fiscallm reads Claude Code and Codex logs on your machine, and a free team dashboard shows spend per developer across Claude Code, Codex, Cursor and Gemini CLI.",
      featureList: [
        "npx fiscallm: Claude Code and Codex cost from local logs, with no account",
        "Cost by tool, model, project and day",
        "Team dashboard: spend per developer across Claude Code, Codex, Cursor and Gemini CLI",
        "Budget alerts per developer and a warning when an agent loops",
        "No proxy; prompts and code are never stored",
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

export default function ForTeams() {
  return (
    <div className="flex min-h-full flex-1 flex-col overflow-x-clip">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <SiteHeader />
      <main className="flex flex-col">
        <Hero />
        <ClaudeCode />
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
          <Words text="What does your" start={0} /> <Words text="AI coding cost?" start={3} gradient />
        </h1>
        <p className="fade-up delay-2 mt-6 max-w-2xl text-lg text-muted sm:text-xl">
          An open-source cost tracker for Claude Code, Codex, Cursor and Gemini CLI. One command on your machine, or one page for your whole
          team.
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
        body="Claude Code, Codex and Gemini CLI already report their usage with OpenTelemetry, and Cursor is read with a team admin key. FiscaLLM puts every developer on one page. Nothing sits between your tools and the model."
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
      <p className="mt-6 text-center text-sm">
        <Link href="/integrations/claude-code" className="font-medium text-accent hover:underline">
          Full setup: teams, names and what is stored →
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
            exactly what it collects, or host it yourself. Questions, bugs and ideas are welcome:{" "}
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
        <h2 className="relative text-3xl font-semibold tracking-tight sm:text-5xl">Know what your AI coding costs.</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/70">
          Run <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-base">npx fiscallm</code>. Free and open source, with no paid plans.
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
