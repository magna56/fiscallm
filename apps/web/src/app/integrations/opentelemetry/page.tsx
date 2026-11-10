import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";

const TITLE = "LLM cost per user from OpenTelemetry traces";
const PATH = "/integrations/opentelemetry";
const DESCRIPTION =
  "Already tracing AI calls with OpenTelemetry? Add one OTLP exporter and FiscaLLM turns the GenAI spans into cost and margin per user. No second SDK, no proxy, no prompts stored.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const FAQ: [string, string][] = [
  [
    "Do I have to stop sending traces to Langfuse, Datadog or Grafana?",
    "No. Add FiscaLLM as a second exporter. Your current backend keeps getting every span; FiscaLLM reads the AI call spans and ignores the rest.",
  ],
  [
    "Does FiscaLLM store prompts or responses from the spans?",
    "No. It reads the model, the token counts, the user ID and an optional feature name. Message content on a span is never read or stored.",
  ],
  [
    "Which instrumentation libraries work?",
    "Anything that follows the OpenTelemetry GenAI semantic conventions: the Vercel AI SDK, OpenLLMetry (Traceloop), OpenInference (Arize) and the OpenTelemetry instrumentations for the OpenAI and Anthropic SDKs.",
  ],
  [
    "What if a span has no user ID?",
    "It is skipped and counted in the response as a rejected span, with a message that says to set user.id. Cost without a user cannot be matched to revenue.",
  ],
  [
    "Will an agent run be counted twice?",
    "No. Only the spans that are one model call are counted. Wrapper spans (the agent, a step, a tool call) are skipped, and each span is stored once even if the exporter retries.",
  ],
];

export default function Page() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} crumb={{ href: "/integrations", label: "Integrations" }} faq={FAQ}>
      <p>
        <strong>In short:</strong> point an OTLP/HTTP trace exporter at <code>https://fiscallm.com/api/v1/otel</code> with your ingest key in the{" "}
        <code>Authorization</code> header, and put a <code>user.id</code> attribute on your spans. Every AI call span becomes a cost event for that user.
        There is no FiscaLLM SDK to install.
      </p>
      <p>
        Traces already say which model ran and how many tokens it used. What they don&apos;t say is whether the user behind them pays you more than they
        cost. FiscaLLM adds that: it prices each call, adds it up per user, and sets it next to revenue from RevenueCat, Stripe or your own billing.
      </p>

      <h2 id="setup">1. Add the exporter</h2>
      <p>
        <Link href="/login">Create an app</Link> and copy the ingest key. If your OpenTelemetry SDK is configured by environment variables and FiscaLLM is
        the only place traces go:
      </p>
      <pre>
        <code>{`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://fiscallm.com/api/v1/otel/v1/traces
OTEL_EXPORTER_OTLP_TRACES_HEADERS=Authorization=Bearer%20<FISCALLM_KEY>`}</code>
      </pre>
      <p>Most teams already export somewhere else. Add a second exporter in code (Node shown):</p>
      <pre>
        <code>{`import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";

const fiscallm = new OTLPTraceExporter({
  url: "https://fiscallm.com/api/v1/otel/v1/traces",
  headers: { Authorization: \`Bearer \${process.env.FISCALLM_KEY}\` },
});

new NodeTracerProvider({
  spanProcessors: [
    new BatchSpanProcessor(yourExistingExporter),
    new BatchSpanProcessor(fiscallm),
  ],
}).register();`}</code>
      </pre>
      <p>Or in the OpenTelemetry Collector, with no code change at all:</p>
      <pre>
        <code>{`exporters:
  otlphttp/fiscallm:
    endpoint: https://fiscallm.com/api/v1/otel
    headers:
      Authorization: Bearer \${env:FISCALLM_KEY}

service:
  pipelines:
    traces:
      exporters: [otlphttp/fiscallm, your-existing-exporter]`}</code>
      </pre>
      <p>JSON and protobuf are both accepted, with or without gzip. Metrics and logs sent to the same endpoint are accepted and dropped.</p>

      <h2 id="user">2. Say who the user is</h2>
      <p>
        Set <code>user.id</code> to the same ID your billing knows (the RevenueCat app user ID, or the <code>user_id</code> in Stripe metadata). The safest
        place is on the AI call span itself, or as a resource attribute if one process serves one user.
      </p>
      <pre>
        <code>{`import { trace } from "@opentelemetry/api";

trace.getActiveSpan()?.setAttribute("user.id", userId);`}</code>
      </pre>
      <p>
        FiscaLLM also looks at the span&apos;s parents and the rest of the trace, so an ID set on your request span usually works. One caveat: a batch
        exporter can send a child span before its parent has ended. If the ID is only on the parent, that call can arrive without a user and be skipped.
        Setting the ID on every span avoids it.
      </p>
      <p>These attribute names are read, in this order:</p>
      <pre>
        <code>{`fiscallm.user_id, user.id, enduser.id, app.user.id,
ai.telemetry.metadata.userId, ai.settings.context.userId,
langfuse.user.id, traceloop.association.properties.user_id,
langsmith.metadata.user_id, session.user.id`}</code>
      </pre>

      <h2 id="read">What is read from a span</h2>
      <table>
        <thead>
          <tr>
            <th>Value</th>
            <th>Attributes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Which spans count</td>
            <td>
              <code>gen_ai.operation.name</code> of <code>chat</code>, <code>text_completion</code>, <code>generate_content</code> or{" "}
              <code>embeddings</code>; OpenInference <code>LLM</code> and <code>EMBEDDING</code> spans
            </td>
          </tr>
          <tr>
            <td>Model</td>
            <td>
              <code>gen_ai.response.model</code>, <code>gen_ai.request.model</code>, <code>llm.model_name</code>
            </td>
          </tr>
          <tr>
            <td>Provider</td>
            <td>
              <code>gen_ai.provider.name</code>, <code>gen_ai.system</code>
            </td>
          </tr>
          <tr>
            <td>Tokens</td>
            <td>
              <code>gen_ai.usage.input_tokens</code>, <code>gen_ai.usage.output_tokens</code>, <code>gen_ai.usage.cache_read.input_tokens</code>,{" "}
              <code>gen_ai.usage.cache_creation.input_tokens</code> (and the OpenInference <code>llm.token_count.*</code> names)
            </td>
          </tr>
          <tr>
            <td>Feature (optional)</td>
            <td>
              <code>fiscallm.feature</code>, <code>gen_ai.agent.name</code>, <code>traceloop.workflow.name</code>
            </td>
          </tr>
          <tr>
            <td>Exact cost (optional)</td>
            <td>
              <code>fiscallm.cost_usd</code>, when you already know the cost and want it used as is
            </td>
          </tr>
          <tr>
            <td>Job (optional)</td>
            <td>
              <code>fiscallm.job_id</code>, for <Link href="/docs#jobs">pay-per-job apps</Link>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Cached input is priced at the cached rate and not counted twice. A model that is not in <Link href="/llm-pricing">the price table</Link> is stored
        and shown as unpriced until you set a price.
      </p>

      <h2 id="check">3. Check that it works</h2>
      <p>
        The app&apos;s Setup page shows the first event when it arrives. From the exporter&apos;s side, a <code>200</code> with an empty body means every AI
        call span was stored. A <code>200</code> with <code>partialSuccess</code> names what was skipped and why, for example spans with no user ID. A{" "}
        <code>401</code> means the key is missing or wrong.
      </p>
      <p>
        Then connect revenue (<Link href="/docs#revenuecat">RevenueCat</Link>, <Link href="/stripe">Stripe</Link> or{" "}
        <Link href="/docs#revenue-csv">a CSV</Link>) and the dashboard shows margin per user. The same numbers are available to scripts and AI agents
        through <Link href="/mcp">the MCP server</Link> and the <Link href="/docs#read-api">read API</Link>.
      </p>

      <h2 id="related">Related</h2>
      <ul>
        <li>
          <Link href="/integrations/vercel-ai-sdk">Vercel AI SDK</Link>: the exact telemetry settings for <code>generateText</code> and{" "}
          <code>streamText</code>
        </li>
        <li>
          <Link href="/integrations/litellm">LiteLLM</Link>: one callback in the proxy config
        </li>
        <li>
          <Link href="/compare">FiscaLLM next to Langfuse, Helicone and others</Link>
        </li>
      </ul>
    </GuideShell>
  );
}
