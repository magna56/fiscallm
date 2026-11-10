import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";

const TITLE = "LiteLLM cost per user, next to revenue";
const PATH = "/integrations/litellm";
const DESCRIPTION =
  "Add one callback to your LiteLLM proxy config and FiscaLLM shows what each end user costs against what they pay. Uses LiteLLM's own cost figure. No SDK, no code change.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const FAQ: [string, string][] = [
  [
    "Does this need LiteLLM Enterprise?",
    "No. The generic_api callback is part of the open-source proxy. This setup was tested on the open-source LiteLLM 1.83.9.",
  ],
  [
    "LiteLLM already tracks spend per end user. What does FiscaLLM add?",
    "Revenue. LiteLLM shows what a user cost. FiscaLLM puts that next to what the same user paid through RevenueCat, Stripe or your billing, net of fees, so you see margin per user, plan and trial, and get alerted when a paying user loses money.",
  ],
  [
    "Which cost is used, LiteLLM's or FiscaLLM's?",
    "LiteLLM's response_cost, as is. So custom prices, discounts and models you priced yourself in LiteLLM carry over. If a log has no cost, FiscaLLM prices it from the token counts.",
  ],
  [
    "Are prompts and responses sent?",
    "LiteLLM's log can include them, depending on your settings. FiscaLLM never reads or stores them. To keep them off the wire entirely, set turn_off_message_logging: true under litellm_settings.",
  ],
  [
    "What happens to requests with no user?",
    "They are skipped and counted in the response under skipped.noUser, with a hint. Cost without a user cannot be matched to revenue.",
  ],
];

export default function Page() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} crumb={{ href: "/integrations", label: "Integrations" }} faq={FAQ}>
      <p>
        <strong>In short:</strong> add a <code>generic_api</code> callback to the LiteLLM proxy config that posts to{" "}
        <code>https://fiscallm.com/api/v1/litellm</code>, and send <code>user</code> with each request. Every successful call becomes a cost event for that
        user, priced with LiteLLM&apos;s own figure. Nothing changes in your application code.
      </p>

      <h2 id="setup">1. Add the callback</h2>
      <p>
        <Link href="/login">Create an app</Link>, copy the ingest key, and set it as <code>FISCALLM_KEY</code> in the proxy&apos;s environment. Then in{" "}
        <code>config.yaml</code>:
      </p>
      <pre>
        <code>{`litellm_settings:
  callbacks: ["fiscallm"]

callback_settings:
  fiscallm:
    callback_type: generic_api
    endpoint: https://fiscallm.com/api/v1/litellm
    headers:
      Authorization: os.environ/FISCALLM_KEY`}</code>
      </pre>
      <p>
        LiteLLM fills in <code>os.environ/FISCALLM_KEY</code> from the environment, so the key never sits in the file. Restart the proxy. It keeps answering requests exactly as before; logs are posted in the background after each one.</p>

      <h2 id="user">2. Send the user with each request</h2>
      <p>
        Use the ID your billing knows (the RevenueCat app user ID, or the <code>user_id</code> in Stripe metadata). The standard OpenAI <code>user</code>{" "}
        field is enough:
      </p>
      <pre>
        <code>{`const res = await openai.chat.completions.create({
  model: "gpt-5-mini",
  messages,
  user: userId,                              // who the cost belongs to
  metadata: { tags: ["feature:search"] },    // optional: split cost by feature
});`}</code>
      </pre>
      <p>The user is taken from the first of these that is set:</p>
      <ol>
        <li>
          <code>fiscallm_user_id</code> in the request&apos;s <code>metadata</code> or in <code>spend_logs_metadata</code>
        </li>
        <li>
          the request&apos;s <code>user</code> (LiteLLM&apos;s end user)
        </li>
        <li>the end user or internal user attached to the virtual key</li>
      </ol>
      <p>
        So if you give each customer their own virtual key with a <code>user_id</code>, it works with no change to requests at all.
      </p>

      <h2 id="read">What is read from a log</h2>
      <table>
        <thead>
          <tr>
            <th>Value</th>
            <th>From</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cost</td>
            <td>
              <code>response_cost</code>
            </td>
          </tr>
          <tr>
            <td>Model and provider</td>
            <td>
              <code>model</code>, <code>custom_llm_provider</code>
            </td>
          </tr>
          <tr>
            <td>Tokens</td>
            <td>
              <code>prompt_tokens</code>, <code>completion_tokens</code>, and cache reads and writes from the usage object
            </td>
          </tr>
          <tr>
            <td>Feature (optional)</td>
            <td>
              a <code>feature:&lt;name&gt;</code> request tag, or <code>feature</code> in the metadata
            </td>
          </tr>
          <tr>
            <td>Job (optional)</td>
            <td>
              <code>job_id</code> in the metadata, for <Link href="/docs#jobs">pay-per-job apps</Link>
            </td>
          </tr>
        </tbody>
      </table>
      <p>Failed requests are skipped because they cost nothing. Each log is stored once, so a retried callback cannot double count.</p>

      <h2 id="check">3. Check that it works</h2>
      <p>
        The app&apos;s Setup page shows the first event when it arrives. You can also post one log by hand; the answer says what was stored and what was
        skipped:
      </p>
      <pre>
        <code>{`curl https://fiscallm.com/api/v1/litellm \\
  -H "Authorization: Bearer $FISCALLM_KEY" -H "Content-Type: application/json" \\
  -d '[{"id":"test-1","status":"success","model":"gpt-4o-mini","custom_llm_provider":"openai",
        "end_user":"user_123","prompt_tokens":1200,"completion_tokens":300,
        "response_cost":0.00036,"endTime":'$(date +%s)'}]'

{"accepted":1,"duplicates":0,"skipped":{"failedRequests":0,"noUser":0,"badTime":0}}`}</code>
      </pre>
      <p>
        Then connect revenue (<Link href="/docs#revenuecat">RevenueCat</Link>, <Link href="/stripe">Stripe</Link> or{" "}
        <Link href="/docs#revenue-csv">a CSV</Link>) and the dashboard shows margin per user. The same numbers are available to scripts and AI agents
        through <Link href="/mcp">the MCP server</Link> and the <Link href="/docs#read-api">read API</Link>.
      </p>

      <h2 id="python">Using the LiteLLM Python SDK without the proxy</h2>
      <p>
        Use the <Link href="/docs#python">FiscaLLM Python SDK</Link> after the call (<code>meter.track(...)</code> with the cost from{" "}
        <code>litellm.completion_cost</code>), or send traces with <Link href="/integrations/opentelemetry">OpenTelemetry</Link>.
      </p>

      <h2 id="related">Related</h2>
      <ul>
        <li>
          <Link href="/compare/fiscallm-vs-litellm">FiscaLLM and LiteLLM compared</Link>
        </li>
        <li>
          <Link href="/integrations/opentelemetry">OpenTelemetry</Link> and <Link href="/integrations/vercel-ai-sdk">Vercel AI SDK</Link>
        </li>
      </ul>
    </GuideShell>
  );
}
