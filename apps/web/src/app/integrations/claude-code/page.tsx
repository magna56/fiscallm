import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";

const TITLE = "Claude Code spend per developer and team";
const PATH = "/integrations/claude-code";
const DESCRIPTION =
  "See what each developer and team spends in Claude Code. Point Claude Code's built-in OpenTelemetry export at FiscaLLM: five settings, no proxy, no wrapper, prompts never stored. Free and open source.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const FAQ: [string, string][] = [
  [
    "Doesn't Anthropic already show Claude Code spend per developer?",
    "Partly. The Claude Console shows estimated spend per user for teams on API keys, and the Enterprise plan has cost by user and group. On the Team plan, and with Pro or Max seats, cost per developer comes from Claude Code's OpenTelemetry export, which needs somewhere to go. FiscaLLM is that place, with budget alerts.",
  ],
  [
    "Does FiscaLLM see our prompts or code?",
    "No. It reads one kind of event, the model call (api_request): the model, the token counts, Claude Code's cost figure and who made the call. Every other event Claude Code sends is discarded on arrival. Claude Code also redacts prompt text in its telemetry unless you turn that on yourself.",
  ],
  [
    "We pay per seat (Pro, Max or Team). What does the cost mean?",
    "It is Claude Code's own estimate of what each call costs at API prices. On a subscription you pay per seat, so read it as what the usage would have cost on the API: good for comparing developers and teams and for deciding who needs a bigger plan, not a copy of your invoice. With API keys it is close to the bill, but the provider's invoice is still the record.",
  ],
  [
    "Does it work with Cursor, Codex or GitHub Copilot?",
    "Not yet. Only Claude Code is read today. If you need another agent, open an issue on GitHub and say which.",
  ],
  [
    "Can we keep sending Claude Code telemetry to our current backend?",
    "Yes. Send Claude Code to an OpenTelemetry Collector and give the logs pipeline two exporters, your backend and FiscaLLM. The Collector config is on this page.",
  ],
  [
    "How many developers does the free hosted service cover?",
    "It accepts 1,000,000 events per app per month, and one model call is one event. An agent makes many model calls per task, so a large team can still pass that. Self-hosting is free and has no limit.",
  ],
];

export default function Page() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} crumb={{ href: "/integrations", label: "Integrations" }} faq={FAQ}>
      <p>
        <strong>In short:</strong> Claude Code can export its usage with OpenTelemetry. Set five environment variables and every model call arrives in
        FiscaLLM with the developer, the model, the tokens and the cost. You get spend per developer and per team, a budget alert when someone
        passes an amount, and a warning when a session runs away. Nothing is installed on top of Claude Code and no traffic is proxied.
      </p>
      <p>
        It suits a small team on the Team plan, or on Pro and Max seats, that wants one page and an alert without running a collector and
        Grafana. Some teams already have this from Anthropic; see <a href="#anthropic">what Anthropic already gives you</a> before you sign up.
      </p>

      <h2 id="setup">1. Turn on the export</h2>
      <p>
        <Link href="/login">Create an app</Link> for your team&apos;s Claude Code usage and copy its key. Its Setup page shows the settings below
        with the key filled in. Use a separate app, not the one for a product. Then set these wherever Claude Code runs:
      </p>
      <pre>
        <code>{`export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_LOGS_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=https://fiscallm.com/api/v1/otel/v1/logs
export OTEL_EXPORTER_OTLP_LOGS_HEADERS="Authorization=Bearer <FISCALLM_KEY>"`}</code>
      </pre>
      <p>
        For a whole team, put the same values in Claude Code&apos;s settings file instead (the managed settings your admin distributes, or each
        developer&apos;s <code>~/.claude/settings.json</code>):
      </p>
      <pre>
        <code>{`{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_LOGS_PROTOCOL": "http/json",
    "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT": "https://fiscallm.com/api/v1/otel/v1/logs",
    "OTEL_EXPORTER_OTLP_LOGS_HEADERS": "Authorization=Bearer <FISCALLM_KEY>"
  }
}`}</code>
      </pre>
      <p>
        <code>http/protobuf</code> works too. These variables are Claude Code&apos;s own; see{" "}
        <a href="https://code.claude.com/docs/en/monitoring-usage">its monitoring documentation</a> for the full list.
      </p>

      <h2 id="who">2. Who and which team</h2>
      <p>
        A developer who is signed in to Claude Code is recorded under their email. Without a sign-in (an API key only), the account ID or Claude
        Code&apos;s anonymous install ID is used. To name people yourself, or to group by team, add resource attributes:
      </p>
      <pre>
        <code>{`export OTEL_RESOURCE_ATTRIBUTES="team.id=platform,fiscallm.user_id=alice"`}</code>
      </pre>
      <table>
        <thead>
          <tr>
            <th>Value</th>
            <th>Read from, in this order</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Developer</td>
            <td>
              <code>fiscallm.user_id</code>, <code>user.email</code>, <code>user.account_uuid</code>, <code>user.account_id</code>,{" "}
              <code>user.id</code>
            </td>
          </tr>
          <tr>
            <td>Team</td>
            <td>
              <code>fiscallm.feature</code>, <code>team.id</code>, <code>team.name</code>, <code>team</code>, <code>department</code>,{" "}
              <code>cost_center</code>. With none set, the team is <code>claude-code</code>
            </td>
          </tr>
          <tr>
            <td>Model and tokens</td>
            <td>
              <code>model</code>, <code>input_tokens</code>, <code>output_tokens</code>, <code>cache_read_tokens</code>,{" "}
              <code>cache_creation_tokens</code>
            </td>
          </tr>
          <tr>
            <td>Cost</td>
            <td>
              <code>cost_usd</code> (Claude Code&apos;s own figure, which knows about fast mode and cache lifetimes). If it is missing, the call is
              priced from <Link href="/llm-pricing">the price table</Link>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Only the <code>claude_code.api_request</code> event is read. Each call is stored once, by its request ID, even if Claude Code sends it again.
      </p>

      <h2 id="see">3. What you see</h2>
      <ul>
        <li>
          <strong>Users:</strong> model calls and spend per developer over the range you pick, biggest spender first, with a CSV export.
        </li>
        <li>
          <strong>Overview:</strong> total spend, cost per developer, spend per day, cost by model, and cost by team (shown as &quot;Cost by
          feature or team&quot;).
        </li>
        <li>
          <strong>Budgets and alerts:</strong> an email or Slack message when a developer passes an amount in a day or in 30 days, when the whole
          team passes a daily amount, or when someone uses more tokens in 5 minutes than you allow, which is how a looping agent shows up. See{" "}
          <Link href="/docs#alerts">the docs</Link>.
        </li>
        <li>
          <strong>For scripts and agents:</strong> the same numbers through the <Link href="/docs#read-api">read API</Link> and{" "}
          <Link href="/mcp">the MCP server</Link>, so you can ask Claude who spent the most this week.
        </li>
      </ul>

      <h2 id="anthropic">What Anthropic already gives you</h2>
      <p>You may not need FiscaLLM. It depends on how your team pays for Claude Code.</p>
      <table>
        <thead>
          <tr>
            <th>You use</th>
            <th>Without FiscaLLM</th>
            <th>Our advice</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>API keys, in the Claude Console</td>
            <td>The Console has a Claude Code page with estimated spend per user</td>
            <td>Start there. FiscaLLM adds alerts per developer and your own team grouping</td>
          </tr>
          <tr>
            <td>Enterprise plan</td>
            <td>An admin dashboard with usage and cost by group and by user, with spend limits</td>
            <td>You probably don&apos;t need FiscaLLM</td>
          </tr>
          <tr>
            <td>Team plan</td>
            <td>
              The analytics dashboard shows usage and contribution, not cost per developer. Cost comes from the OpenTelemetry export or a CSV
              spend report
            </td>
            <td>This is where FiscaLLM helps: a place to send that export, with no collector or Grafana to run</td>
          </tr>
          <tr>
            <td>Pro or Max seats, one per developer</td>
            <td>Each seat is its own account, so there is no shared view</td>
            <td>FiscaLLM puts the team on one page</td>
          </tr>
          <tr>
            <td>Only you</td>
            <td>
              The <code>/cost</code> command, or a local tool such as <a href="https://github.com/ryoppippi/ccusage">ccusage</a>
            </td>
            <td>Use those. They are free and need no account</td>
          </tr>
          <tr>
            <td>Amazon Bedrock or Google Vertex AI</td>
            <td>The same OpenTelemetry export</td>
            <td>Not tested with FiscaLLM yet. If you try it, tell us what you see</td>
          </tr>
        </tbody>
      </table>
      <p>
        As of November 2026. Plans change, so check <a href="https://code.claude.com/docs/en/analytics">Anthropic&apos;s analytics documentation</a>.
        FiscaLLM is not affiliated with Anthropic.
      </p>

      <h2 id="collector">Sending to two places</h2>
      <p>Claude Code has one logs endpoint. To keep your current backend, put an OpenTelemetry Collector in between:</p>
      <pre>
        <code>{`exporters:
  otlphttp/fiscallm:
    endpoint: https://fiscallm.com/api/v1/otel
    headers:
      Authorization: Bearer \${env:FISCALLM_KEY}

service:
  pipelines:
    logs:
      receivers: [otlp]
      exporters: [otlphttp/fiscallm, your-existing-exporter]`}</code>
      </pre>

      <h2 id="limits">What it does not do</h2>
      <ul>
        <li>
          <strong>It is not your invoice.</strong> The cost is Claude Code&apos;s estimate at API prices. On Pro, Max and Team seats you pay per
          seat, whatever the usage.
        </li>
        <li>
          <strong>No productivity numbers.</strong> Lines of code, commits, pull requests and accepted edits are not read. This is about spend.
        </li>
        <li>
          <strong>No revenue or margin.</strong> FiscaLLM can also set a product&apos;s AI cost against what its users pay. An app with no
          revenue connected shows spend only, so those columns are hidden.
        </li>
        <li>
          <strong>The key sits on every developer&apos;s machine.</strong> Anyone who has it can send events and read the app&apos;s totals through
          the API. That is the reason to use a separate app for Claude Code.
        </li>
        <li>
          <strong>Emails are stored</strong> as the user ID when developers are signed in. Set <code>fiscallm.user_id</code> if you want a different
          name there.
        </li>
        <li>
          <strong>Only Claude Code.</strong> Cursor, Codex and Copilot are not read.
        </li>
        <li>
          <strong>Tested with a signed-in Claude account.</strong> Not yet on Amazon Bedrock or Google Vertex AI.
        </li>
      </ul>

      <h2 id="check">Check that it works</h2>
      <p>
        Run one prompt in Claude Code. Events are sent every few seconds, and the app&apos;s Setup page shows the first one when it arrives. To
        test the endpoint by hand, a <code>200</code> with an empty body means every model call was stored, a <code>200</code> with{" "}
        <code>partialSuccess</code> says what was skipped and why, and a <code>401</code> means the key is missing or wrong.
      </p>

      <h2 id="related">Related</h2>
      <ul>
        <li>
          <Link href="/integrations/opentelemetry">OpenTelemetry</Link>: cost per user for your own app, from traces
        </li>
        <li>
          <Link href="/guides/ai-usage-limits-by-plan">Limits by plan</Link>: an AI allowance for each plan your app sells
        </li>
        <li>
          <a href="https://github.com/magna56/fiscallm">Self-host FiscaLLM</a>: free, MIT licensed, no event limit
        </li>
      </ul>
    </GuideShell>
  );
}
