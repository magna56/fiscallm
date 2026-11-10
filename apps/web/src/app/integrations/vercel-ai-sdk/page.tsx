import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";

const TITLE = "Vercel AI SDK cost per user";
const PATH = "/integrations/vercel-ai-sdk";
const DESCRIPTION =
  "Turn the AI SDK's built-in telemetry into cost and margin per user. Works with generateText, streamText, tools and agents, with any provider. No wrapper around your model calls.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const FAQ: [string, string][] = [
  [
    "Does a multi-step tool or agent run count every model call?",
    "Yes. Each step's model call is its own span and its own cost event, so a run with two steps is stored as two calls with their own token counts. The outer spans are not counted, so nothing is doubled.",
  ],
  [
    "Does streaming work?",
    "Yes. streamText records usage on the span when the stream finishes, the same as generateText.",
  ],
  [
    "Which AI SDK versions work?",
    "Tested on AI SDK 7 with @ai-sdk/otel. AI SDK 4 to 6 (experimental_telemetry) emit an older span format, which is read too.",
  ],
  [
    "Which providers work?",
    "Any provider the AI SDK supports. The model ID on the span is priced from FiscaLLM's table for OpenAI, Anthropic and Google models; other models are stored and shown as unpriced until you set a price.",
  ],
  [
    "Are prompts and responses stored?",
    "No. FiscaLLM reads the model, token counts, user ID and function ID from each span and nothing else.",
  ],
];

export default function Page() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} crumb={{ href: "/integrations", label: "Integrations" }} faq={FAQ}>
      <p>
        <strong>In short:</strong> the AI SDK already emits an OpenTelemetry span for every model call, with the model and token counts on it. Export
        those spans to FiscaLLM, attach your user ID, and you get AI cost per user next to what each user pays. Your <code>generateText</code> and{" "}
        <code>streamText</code> calls stay as they are.
      </p>

      <h2 id="setup">1. Export traces to FiscaLLM</h2>
      <p>
        <Link href="/login">Create an app</Link>, copy the ingest key and store it as <code>FISCALLM_KEY</code>. Then register an exporter once at
        startup (in Next.js, in <code>instrumentation.ts</code>):
      </p>
      <pre>
        <code>{`npm install @ai-sdk/otel @opentelemetry/sdk-trace-node @opentelemetry/exporter-trace-otlp-proto`}</code>
      </pre>
      <pre>
        <code>{`import { registerTelemetry } from "ai";
import { OpenTelemetry } from "@ai-sdk/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";

new NodeTracerProvider({
  spanProcessors: [
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: "https://fiscallm.com/api/v1/otel/v1/traces",
        headers: { Authorization: \`Bearer \${process.env.FISCALLM_KEY}\` },
      }),
    ),
  ],
}).register();

// Copy the user ID onto every span the AI SDK creates.
registerTelemetry(
  new OpenTelemetry({
    enrichSpan: ({ runtimeContext }) => ({ "user.id": runtimeContext?.userId }),
  }),
);`}</code>
      </pre>
      <p>
        Already exporting to Langfuse, Datadog or another backend? Keep it and add FiscaLLM as one more span processor. See{" "}
        <Link href="/integrations/opentelemetry">OpenTelemetry</Link>.
      </p>

      <h2 id="user">2. Pass the user ID with each call</h2>
      <pre>
        <code>{`const result = await generateText({
  model: openai("gpt-5-mini"),
  prompt,
  runtimeContext: { userId },                 // the ID your billing knows
  telemetry: {
    functionId: "support-chat",               // shows up as the feature
    includeRuntimeContext: { userId: true },
  },
});`}</code>
      </pre>
      <p>
        <code>userId</code> should be the same ID RevenueCat or Stripe has for this user, so cost and revenue can be matched. <code>functionId</code> is
        optional; it splits cost by feature.
      </p>
      <p>
        If you already put <code>user.id</code> on your own request span, that works too: FiscaLLM looks at the parents of each model call. Setting it
        through <code>enrichSpan</code> is more reliable, because a batch exporter can send the model call before the request span has ended.
      </p>

      <h2 id="older">AI SDK 4, 5 and 6</h2>
      <p>These versions have telemetry built in and need no <code>@ai-sdk/otel</code>. Register the same exporter and pass the user in the metadata:</p>
      <pre>
        <code>{`const result = await generateText({
  model: openai("gpt-5-mini"),
  prompt,
  experimental_telemetry: {
    isEnabled: true,
    functionId: "support-chat",
    metadata: { userId },
  },
});`}</code>
      </pre>

      <h2 id="what">What you get</h2>
      <ul>
        <li>One cost event per model call, including each step of a tool or agent run.</li>
        <li>Cached input priced at the cached rate.</li>
        <li>
          Cost per user, per plan and per feature next to revenue from <Link href="/docs#revenuecat">RevenueCat</Link>,{" "}
          <Link href="/stripe">Stripe</Link> or <Link href="/docs#revenue-csv">a CSV</Link>.
        </li>
        <li>Alerts when a user goes over budget or a paying user costs more than they pay.</li>
      </ul>
      <p>
        <Link href="/demo">See the demo dashboard</Link> (no sign-up).
      </p>

      <h2 id="sdk">Prefer no OpenTelemetry?</h2>
      <p>
        Use the FiscaLLM SDK and report usage from the result yourself. There is a runnable example in{" "}
        <a href="https://github.com/magna56/fiscallm/tree/main/examples/vercel-ai-sdk">examples/vercel-ai-sdk</a>.
      </p>
      <pre>
        <code>{`import { createMeter } from "fiscallm";
const meter = createMeter({ apiKey: process.env.FISCALLM_KEY, waitUntil });

const { usage } = await generateText({ model: openai("gpt-5-mini"), prompt });
meter.track({ userId, provider: "openai", model: "gpt-5-mini", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens });`}</code>
      </pre>

      <h2 id="related">Related</h2>
      <ul>
        <li>
          <Link href="/integrations/opentelemetry">OpenTelemetry</Link>: every attribute that is read, and the Collector setup
        </li>
        <li>
          <Link href="/integrations/litellm">LiteLLM</Link>
        </li>
        <li>
          <Link href="/llm-pricing">LLM API pricing compared</Link>
        </li>
      </ul>
    </GuideShell>
  );
}
