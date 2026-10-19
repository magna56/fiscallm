import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = {
  title: "Integrations · FiscaLLM",
  description:
    "What FiscaLLM connects to: AI providers, revenue sources (RevenueCat, Stripe, any billing system), runtimes, alerts and AI coding assistants, with the status of each.",
  alternates: { canonical: "/integrations" },
};

type Status = "Supported" | "Beta" | "Planned";

function Badge({ status }: { status: Status }) {
  const tone = {
    Supported: "bg-green-100 text-green-800",
    Beta: "bg-amber-100 text-amber-800",
    Planned: "bg-black/[0.06] text-black/60",
  }[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>;
}

function Group({ id, title, intro, rows }: { id: string; title: string; intro: ReactNode; rows: [string, Status, ReactNode][] }) {
  return (
    <>
      <h2 id={id}>{title}</h2>
      <p>{intro}</p>
      <table>
        <thead>
          <tr>
            <th>Integration</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, status, note]) => (
            <tr key={name}>
              <td className="font-medium">{name}</td>
              <td>
                <Badge status={status} />
              </td>
              <td>{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function IntegrationsPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <Prose>
        <h1>Integrations</h1>
        <p>
          <strong>In short:</strong> FiscaLLM needs two things, AI usage from your backend and revenue from your billing. This page lists what it connects to and how
          mature each connection is. For the fine print on what is counted, see <Link href="/coverage">what&apos;s covered</Link>.
        </p>

        <Group
          id="ai"
          title="AI providers"
          intro="One line after each call reads only the model name and token counts from the response."
          rows={[
            ["OpenAI", "Supported", "Chat Completions and Responses, including streaming. Cached input is priced separately."],
            ["Anthropic", "Supported", "Messages, including streaming. Cache reads and writes are priced separately."],
            ["Google Gemini", "Supported", "generateContent, including streaming and long-prompt tiers."],
            ["OpenAI-compatible APIs", "Supported", "Groq, OpenRouter, DeepSeek, Together and similar, through the same helper with a provider name. Priced only for models in our table; otherwise set a price or pass the cost."],
            ["Speech, image and video models", "Supported", "Per-unit pricing (images, seconds, minutes, characters) for the models in our table; pass the exact cost for others."],
            ["Embeddings", "Supported", "Usage is read; the model shows as unpriced until you set a price."],
          ]}
        />

        <Group
          id="revenue"
          title="Revenue sources"
          intro="Revenue is matched to AI cost by user ID, net of fees and tax."
          rows={[
            ["RevenueCat", "Supported", <>Webhook plus a one-time import of past subscribers. See <Link href="/docs#revenuecat">the docs</Link>.</>],
            ["Stripe", "Beta", <>Paid invoices, trials, cancellations and refunds from a webhook. USD only; tested against sample payloads. See <Link href="/docs#stripe">the docs</Link>.</>],
            ["Any other billing system", "Supported", <>One call per payment, refund or cancellation through <Link href="/docs#revenue-api">the revenue API</Link>.</>],
            ["Adapty and Superwall", "Planned", "A webhook converter for each, on the roadmap."],
            ["App Store and Google Play directly", "Planned", "Today use RevenueCat, Stripe or the revenue API."],
          ]}
        />

        <Group
          id="runtimes"
          title="Languages and runtimes"
          intro="Both SDKs have no dependencies and never block or break your response."
          rows={[
            ["TypeScript and JavaScript SDK", "Supported", "Node 20+, Bun, Deno (Supabase Edge Functions), Cloudflare Workers, Vercel functions and Firebase Functions."],
            ["Python SDK", "Supported", "Any Python 3.9+ app, including FastAPI, Django and Flask. Call flush() before returning in AWS Lambda or Cloud Functions."],
            ["Other languages", "Supported", <>Any language, through the <Link href="/docs#api">HTTP API</Link>.</>],
            ["Kill switch", "Supported", "Set FISCALLM_DISABLED=1 and the SDK does nothing at all."],
          ]}
        />

        <Group
          id="outputs"
          title="Alerts, reports and exports"
          intro="What comes out the other side."
          rows={[
            ["Email alerts", "Supported", "A user or the whole app going over a budget you set."],
            ["Webhook alerts", "Supported", "Signed with X-FiscaLLM-Signature, so your backend can act on them."],
            ["Weekly report", "Supported", "A Monday email with last week's margin and the users who lost you money."],
            ["CSV export", "Supported", "Users, plans, trials and cost by model."],
            ["Slack alerts", "Supported", "Paste a Slack incoming-webhook URL as an alert's webhook."],
            ["Runaway-loop alert", "Supported", "A user using more tokens in 5 minutes than you allow."],
            ["Spending caps", "Supported", "Mark a per-user budget as Block and call meter.check(userId) before a request. Fails open; based on cost already recorded."],
          ]}
        />

        <Group
          id="hosting"
          title="Hosting and tooling"
          intro="Use the free hosted service or run your own copy."
          rows={[
            ["Hosted service (fiscallm.com)", "Supported", "Free under fair use: up to 100,000 events per app per month, best effort."],
            ["Self-hosting on Vercel and Supabase", "Supported", <>With a deploy button and a step-by-step guide in <a href="https://github.com/magna56/fiscallm/blob/main/SELF-HOSTING.md">SELF-HOSTING.md</a>.</>],
            ["Docker Compose", "Planned", "Waiting for a machine with Docker to test it properly."],
            ["AI coding assistants", "Supported", <>A <a href="/skill.md">setup skill</a> for Claude Code, plus a prompt for Cursor, Copilot and others. See <Link href="/docs#ai-setup">the docs</Link>.</>],
          ]}
        />

        <p className="mt-10">
          Missing something you need? <a href="https://github.com/magna56/fiscallm/issues">Open an issue</a>, or see the <Link href="/roadmap">roadmap</Link>.
        </p>
      </Prose>
      <SiteFooter />
    </div>
  );
}
