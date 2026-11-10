import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";

const TITLE = "FiscaLLM MCP server: LLM prices and AI margins for agents";
const PATH = "/mcp";
const DESCRIPTION =
  "A free remote MCP server. Any AI agent can look up current LLM prices, estimate and compare the cost of a call, work out a subscription's break-even, and read your app's AI cost and margin per user.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const URL = "https://fiscallm.com/api/mcp";

const PUBLIC_TOOLS: [string, string][] = [
  ["list_llm_prices", "Current list prices of OpenAI, Anthropic and Google models, filtered by provider or name."],
  ["get_llm_price", "One model's price, with its long-context rate and any announced change."],
  ["estimate_llm_cost", "USD cost of a call from its token counts, and the total for a number of calls."],
  ["compare_llm_costs", "The same call priced on several models, cheapest first."],
  ["subscription_break_even", "How many messages a month a subscriber can send before AI cost uses up what they pay, after store or payment fees."],
  ["fiscallm_setup_guide", "How to send usage (OpenTelemetry, LiteLLM, SDK or HTTP), connect revenue and read margins back."],
];

const KEY_TOOLS: [string, string][] = [
  ["get_margin_overview", "AI cost, revenue, margin, AI's share of revenue and the daily series over a period."],
  ["list_users_by_margin", "Each user's AI cost, revenue and margin, the ones losing the most money first."],
  ["get_plan_margins", "AI cost, revenue and margin of each plan or product."],
  ["get_cost_breakdown", "AI cost split by model and by feature."],
];

const FAQ: [string, string][] = [
  [
    "Is the MCP server free? Do I need an account?",
    "The price and cost tools are free and need no account or key. The margin tools read your own app's data, so they need that app's key.",
  ],
  [
    "Can the server change anything in my account?",
    "No. Every tool is read-only.",
  ],
  [
    "Where do the prices come from, and how fresh are they?",
    "From FiscaLLM's open-source price table, checked against the OpenAI, Anthropic and Google pricing pages. Each answer includes the date the table was last checked.",
  ],
  [
    "Which clients work?",
    "Any client that supports remote MCP servers over Streamable HTTP, including Claude Code, Claude, Cursor and VS Code. There is nothing to install or run locally.",
  ],
  [
    "Does the server see my prompts?",
    "Only the arguments a tool is called with, such as a model name and token counts. FiscaLLM never stores prompts or responses from your app.",
  ],
];

function ToolTable({ rows }: { rows: [string, string][] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Tool</th>
          <th>What it answers</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, what]) => (
          <tr key={name}>
            <td>
              <code>{name}</code>
            </td>
            <td>{what}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Page() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} crumb={{ href: "/integrations", label: "Integrations" }} faq={FAQ}>
      <p>
        <strong>In short:</strong> add <code>{URL}</code> to your AI assistant as a remote MCP server. It can then answer questions like &quot;what would
        this feature cost on Claude Haiku instead of GPT-5 mini?&quot; from a real price table, and, with your app&apos;s key, &quot;which users cost me
        more than they pay?&quot;
      </p>

      <h2 id="connect">Connect</h2>
      <p>Claude Code:</p>
      <pre>
        <code>{`claude mcp add --transport http fiscallm ${URL}`}</code>
      </pre>
      <p>
        Cursor (<code>.cursor/mcp.json</code>):
      </p>
      <pre>
        <code>{`{
  "mcpServers": {
    "fiscallm": { "url": "${URL}" }
  }
}`}</code>
      </pre>
      <p>
        VS Code (<code>.vscode/mcp.json</code>):
      </p>
      <pre>
        <code>{`{
  "servers": {
    "fiscallm": { "type": "http", "url": "${URL}" }
  }
}`}</code>
      </pre>
      <p>
        In other clients, add a custom or remote MCP server with the URL <code>{URL}</code>. The transport is Streamable HTTP and the server keeps no
        session.
      </p>

      <h2 id="public">Tools that need no key</h2>
      <ToolTable rows={PUBLIC_TOOLS} />
      <p>Things to ask once it is connected:</p>
      <ul>
        <li>&quot;Compare the cost of 1,500 input and 400 output tokens on GPT-5 mini, Claude Haiku 4.5 and Gemini 2.5 Flash, for 300 calls a month.&quot;</li>
        <li>&quot;My plan is $9.99 a month through the App Store. How many messages can a user send on Claude Sonnet before I lose money?&quot;</li>
        <li>&quot;How much does prompt caching save on this prompt?&quot;</li>
      </ul>

      <h2 id="margins">Tools for your own app</h2>
      <p>
        These read the same numbers as the dashboard. Send your app&apos;s ingest key as a header; keep it in an environment variable, not in a file you
        commit.
      </p>
      <pre>
        <code>{`claude mcp add --transport http fiscallm ${URL} \\
  --header "Authorization: Bearer $FISCALLM_KEY"`}</code>
      </pre>
      <ToolTable rows={KEY_TOOLS} />
      <p>Things to ask:</p>
      <ul>
        <li>&quot;Which users lost me money in the last 30 days, and on which feature?&quot;</li>
        <li>&quot;What share of revenue went to AI this week compared with last week?&quot;</li>
        <li>&quot;Which plan has the worst margin?&quot;</li>
      </ul>
      <p>
        No data yet? <Link href="/login">Create an app</Link> and send usage with <Link href="/integrations/opentelemetry">OpenTelemetry</Link>,{" "}
        <Link href="/integrations/litellm">LiteLLM</Link>, the <Link href="/integrations/vercel-ai-sdk">Vercel AI SDK</Link> or{" "}
        <Link href="/docs#sdk">the SDK</Link>.
      </p>

      <h2 id="http">The same data over plain HTTP</h2>
      <p>
        Not using MCP? The price tools are also a <Link href="/llm-pricing/api">free JSON API</Link>, and the margin tools are the{" "}
        <Link href="/docs#read-api">read API</Link>. Both are described in <a href="/openapi.json">openapi.json</a>.
      </p>

      <h2 id="details">Details</h2>
      <ul>
        <li>
          Endpoint: <code>POST {URL}</code>, JSON-RPC, one message per request.
        </li>
        <li>Protocol versions: 2025-11-25, 2025-06-18, 2025-03-26 and 2024-11-05.</li>
        <li>Read-only. No sessions, no server-sent events, no resources or prompts.</li>
        <li>
          Open source (MIT): <a href="https://github.com/magna56/fiscallm/blob/main/apps/api/src/mcp/route.ts">apps/api/src/mcp/route.ts</a>. A
          self-hosted copy serves the same server at <code>/api/mcp</code>.
        </li>
      </ul>
    </GuideShell>
  );
}
