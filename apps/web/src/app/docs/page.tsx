import type { Metadata } from "next";
import Link from "next/link";
import { SKILL_INSTALL, SKILL_PROMPT } from "@/components/ai-setup";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = {
  title: "Docs · FiscaLLM",
  alternates: { canonical: "/docs" },
  description: "Set up FiscaLLM: the SDK, AI limits by plan, RevenueCat and Stripe, user IDs, prices and the API.",
};

export default function DocsPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <Prose>
        <h1>Docs</h1>
        <p>
          <strong>In short:</strong> your backend reports each user&apos;s AI usage with one line of code, and RevenueCat or Stripe reports their plan
          and what they paid. FiscaLLM then <a href="#plan-limits">limits AI usage by plan</a> (and tells your app what is left, for the paywall) and
          shows the margin per user, plan and trial. Setup takes about ten minutes. Curious what happens under the hood?{" "}
          <a href="/how-it-works">How it works</a>.
        </p>
        <p>
          Fastest: <a href="#ai-setup">let your AI coding assistant do it</a>. Otherwise follow the quickstart below.
        </p>

        <h2 id="quickstart">Quickstart</h2>
        <ol>
          <li>
            <a href="/login">Sign in</a> and create an app. Copy the ingest key (shown once) and store it on your backend as <code>FISCALLM_KEY</code>.
          </li>
          <li>Install the SDK on your backend and track each AI call (below).</li>
          <li>Add the webhook URL from the app&apos;s Setup page to RevenueCat (below).</li>
        </ol>
        <p>The Setup page shows when the first event and the first webhook arrive, and how many of your AI users it could match to RevenueCat. No RevenueCat? <a href="#revenue-api">Send revenue with the API</a>.</p>

        <h2 id="no-sdk">Already tracing or using a gateway?</h2>
        <p>You can skip the SDK. Step 2 of the quickstart becomes one of these:</p>
        <ul>
          <li>
            <a href="/integrations/opentelemetry">OpenTelemetry</a>: point an OTLP/HTTP trace exporter at <code>https://fiscallm.com/api/v1/otel</code>{" "}
            with <code>Authorization: Bearer &lt;FISCALLM_KEY&gt;</code> and set <code>user.id</code> on your spans.
          </li>
          <li>
            <a href="/integrations/vercel-ai-sdk">Vercel AI SDK</a>: the same endpoint, fed by the AI SDK&apos;s built-in telemetry.
          </li>
          <li>
            <a href="/integrations/litellm">LiteLLM</a>: a <code>generic_api</code> callback in the proxy config that posts to{" "}
            <code>https://fiscallm.com/api/v1/litellm</code>.
          </li>
        </ul>
        <p>Revenue, alerts and the dashboard work the same whichever way usage arrives.</p>
        <p>
          Tracking a team&apos;s coding agents instead of an app&apos;s users? <a href="/integrations/claude-code">Claude Code</a> can send its
          usage straight to <code>https://fiscallm.com/api/v1/otel/v1/logs</code>, for spend per developer and team.
        </p>

        <h2 id="ai-setup">Set up with an AI assistant</h2>
        <p>
          The <a href="/skill.md">FiscaLLM setup skill</a> tells a coding assistant how to find your AI calls, add the SDK, pass the RevenueCat user ID
          through and leave the keys to you. In Claude Code, install it in your project and ask it to &quot;set up FiscaLLM&quot;:
        </p>
        <pre>
          <code>{SKILL_INSTALL}</code>
        </pre>
        <p>In Cursor, Copilot or another assistant, paste:</p>
        <pre>
          <code>{SKILL_PROMPT}</code>
        </pre>

        <h2 id="sdk">The SDK</h2>
        <div className="my-5 rounded-2xl border border-[#6d5dfc]/20 bg-[#6d5dfc]/[0.06] p-4 text-sm">
          <p className="!my-0 font-medium text-foreground">What is <code>res</code>? And what do we read from it?</p>
          <p className="!my-1.5">
            <code>res</code> is the object your AI provider&apos;s SDK returned for the call you just made. FiscaLLM reads exactly two things from it:{" "}
            <strong>the model name</strong> and <strong>the token counts</strong> (<code>res.usage</code>).
          </p>
          <p className="!my-0">
            It never reads the answer text, the prompt or any message content, and none of that is sent. Only the model name and the counts leave your backend.
          </p>
        </div>
        <pre>
          <code>npm install fiscallm</code>
        </pre>
        <p>
          Zero dependencies. Runs on Node 20+, Cloudflare Workers, Vercel, Supabase Edge Functions (Deno), Bun and Firebase. It never throws, never
          blocks your response, and sends only token counts: prompts and responses never leave your backend.
        </p>
        <pre>
          <code>{`import { createMeter } from "fiscallm";

const meter = createMeter({
  apiKey: env.FISCALLM_KEY,
  waitUntil, // optional, see "Serverless platforms"
});

// userId: the user's RevenueCat app user ID
const res = await openai.chat.completions.create({ model, messages });
meter.trackOpenAI(res, { userId, feature: "chat" });`}</code>
        </pre>

        <h3>Providers</h3>
        <table>
          <thead>
            <tr>
              <th>Call</th>
              <th>Pass</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>meter.trackOpenAI(res, ctx)</code></td>
              <td>A Chat Completions or Responses API result, from the SDK or <code>await r.json()</code></td>
            </tr>
            <tr>
              <td><code>meter.trackAnthropic(res, ctx)</code></td>
              <td>A Messages API result</td>
            </tr>
            <tr>
              <td><code>meter.trackGemini(res, ctx)</code></td>
              <td>A <code>generateContent</code> result, from <code>@google/genai</code> or REST</td>
            </tr>
            <tr>
              <td><code>meter.track(event)</code></td>
              <td>Anything else: tokens, or an exact <code>costUsd</code> for images and voice</td>
            </tr>
          </tbody>
        </table>
        <p>
          <code>ctx</code> is <code>{`{ userId, feature?, provider?, model? }`}</code>. <code>feature</code> is your own label (&quot;chat&quot;,
          &quot;summary&quot;) to break cost down by. For OpenAI-compatible APIs such as Groq, OpenRouter or DeepSeek, use{" "}
          <code>trackOpenAI(res, {`{ userId, provider: "groq" }`})</code>.
        </p>
        <h3 id="units">Images, audio and video</h3>
        <p>
          Image and speech models that report tokens (<code>gpt-image-*</code>, <code>gpt-4o-mini-tts</code>, realtime voice, Gemini image, TTS
          and Live models) work with the helpers above and are priced at their media rates. For usage billed per unit, pass{" "}
          <code>units</code> and a <code>unit</code> of <code>minute</code>, <code>second</code>, <code>character</code> or <code>image</code>; add a{" "}
          <code>variant</code> where the price depends on resolution or size. FiscaLLM prices Whisper and other transcription per minute,{" "}
          <code>tts-1</code> per character, Veo video per second and Gemini images per image.
        </p>
        <pre>
          <code>{`meter.track({ userId, provider: "openai", model: "whisper-1", units: 12.5, unit: "minute" });
meter.track({ userId, provider: "openai", model: "tts-1", units: text.length, unit: "character" });
meter.track({ userId, provider: "google", model: "veo-3.1-fast-generate-preview",
              units: 8, unit: "second", variant: "1080p" });
meter.track({ userId, provider: "google", model: "gemini-3-pro-image", units: 1, unit: "image", variant: "4k" });

// Anything else: the exact cost, which wins over FiscaLLM's prices
meter.track({ userId, provider: "fal", model: "flux-pro", costUsd: 0.05, feature: "avatar" });`}</code>
        </pre>

        <h3>Streaming</h3>
        <p>
          Wrap the stream; chunks pass through unchanged and usage is recorded when it ends. OpenAI Chat Completions only reports usage with{" "}
          <code>stream_options: {`{ include_usage: true }`}</code>.
        </p>
        <pre>
          <code>{`const stream = meter.trackStream(
  await openai.chat.completions.create({
    model, messages, stream: true,
    stream_options: { include_usage: true },
  }),
  { userId },
);
for await (const chunk of stream) { /* ... */ }`}</code>
        </pre>
        <p>If your backend proxies a provider&apos;s raw server-sent events straight to the app, wrap the response instead:</p>
        <pre>
          <code>{`const upstream = await fetch("https://api.anthropic.com/v1/messages", init);
return meter.trackSSE(upstream, { userId });`}</code>
        </pre>

        <h3 id="serverless">Serverless platforms</h3>
        <p>Events are batched and sent in the background. On serverless platforms, tell the SDK how to keep the function alive until they are sent:</p>
        <table>
          <tbody>
            <tr>
              <td>Cloudflare Workers</td>
              <td><code>createMeter({`{ apiKey, waitUntil: ctx.waitUntil.bind(ctx) }`})</code></td>
            </tr>
            <tr>
              <td>Vercel</td>
              <td><code>import {`{ waitUntil }`} from &quot;@vercel/functions&quot;</code>, then pass <code>waitUntil</code></td>
            </tr>
            <tr>
              <td>Supabase Edge Functions</td>
              <td><code>waitUntil: (p) =&gt; EdgeRuntime.waitUntil(p)</code></td>
            </tr>
            <tr>
              <td>Firebase, AWS Lambda</td>
              <td><code>await meter.flush()</code> before returning</td>
            </tr>
            <tr>
              <td>Long-running Node server</td>
              <td>Nothing: events are sent every two seconds</td>
            </tr>
          </tbody>
        </table>
        <p>Each request has a two-second timeout and one retry. If FiscaLLM is unreachable, events are dropped and your app is unaffected.</p>


        <h2 id="python">Python</h2>
        <pre>
          <code>pip install fiscallm</code>
        </pre>
        <p>Same helpers and guarantees as the TypeScript SDK, with no dependencies, on Python 3.9+. Tracking only queues; a background thread sends.</p>
        <pre>
          <code>{`import os
from fiscallm import Meter

meter = Meter(api_key=os.environ["FISCALLM_KEY"])  # one per process

res = client.chat.completions.create(model=model, messages=messages)
meter.track_openai(res, user_id=user_id, feature="chat")
# also: track_anthropic, track_gemini, track(...)

# Streams, sync or async: iterate the returned stream
stream = meter.track_stream(response_stream, user_id=user_id)

# AWS Lambda, Cloud Functions: before returning
meter.flush()   # or: await meter.aflush()`}</code>
        </pre>

        <h2 id="user-ids">User IDs</h2>
        <p>
          <strong>The <code>userId</code> you send must be the user&apos;s RevenueCat app user ID.</strong> That is how AI cost is joined to revenue.
        </p>
        <ul>
          <li>If you log users in to RevenueCat with your own IDs, send the same ID.</li>
          <li>
            If you use RevenueCat&apos;s anonymous IDs, send <code>Purchases.shared.appUserID</code> (iOS), <code>Purchases.sharedInstance.appUserID</code>{" "}
            (Android) or the equivalent from the app to your backend with each request.
          </li>
          <li>Aliases and transfers are followed automatically, so a user who starts anonymous and later logs in stays one user.</li>
        </ul>
        <p>
          Users with AI cost but no RevenueCat record appear as &quot;free or unmatched&quot;. Free users never reach RevenueCat, so some unmatched cost is
          expected. A low match rate on the Setup page usually means the IDs differ.
        </p>

        <h2 id="revenuecat">RevenueCat</h2>
        <p>
          <strong>Connect RevenueCat</strong> (on fiscallm.com): press the button on your app&apos;s Setup page and approve access in RevenueCat. FiscaLLM
          then adds its webhook to your project and imports your past subscribers. Nothing to copy or paste. It asks for read-only access to customers,
          subscriptions and purchases, read access to your project list, and permission to manage webhooks (to add its own). Tokens are stored
          encrypted; Disconnect on the Setup page removes FiscaLLM&apos;s webhook and deletes them. If your account has several projects, you pick one.
          On RevenueCat&apos;s approval screen, keep <strong>Read &amp; Write</strong>. FiscaLLM only ever requests read access to customer data;
          the write permission is what lets it add its webhook, and with Read only the connection stops and asks you to try again. The webhook
          covers production and sandbox; sandbox purchases count only while test mode is on (Settings).
        </p>
        <p>Or set it up by hand (and on self-hosted copies, which have no RevenueCat OAuth client):</p>
        <ol>
          <li>In RevenueCat: Project → Integrations → Webhooks → Create new webhook.</li>
          <li>Webhook URL and Authorization header value: copy both from your app&apos;s Setup page.</li>
          <li>Environment: Production. To test with sandbox or Test Store purchases, choose both and turn on test mode in Settings.</li>
        </ol>
        <p>
          Revenue is net: price × (1 − tax − store commission), as RevenueCat reports them. Refunds subtract on the day they happen.
        </p>
        <p>
          RevenueCat sends only new events. Connect RevenueCat imports past subscribers by itself; with the manual setup, use Settings → Import past subscribers: paste
          your RevenueCat project ID and a v2 secret key with read-only access to customer information and project configuration, and FiscaLLM imports their purchases,
          renewals and trials from RevenueCat&apos;s API. Purchases the webhook already delivered are skipped, so nothing counts twice.
          App Store and Play Store subscriptions come in renewal by renewal; for other stores (Stripe, Web Billing) RevenueCat only reports each
          subscription&apos;s total, which is counted on its start date. The key is
          stored encrypted only while the import runs.
        </p>

        <h2 id="stripe">Stripe</h2>
        <p>
          If you bill through Stripe, connect it from your app&apos;s Setup page: add a Stripe webhook endpoint with the URL shown there, choose{" "}
          <code>invoice.paid</code>, <code>customer.subscription.created</code>, <code>customer.subscription.updated</code>,{" "}
          <code>customer.subscription.deleted</code>, <code>charge.refunded</code> and <code>charge.dispute.closed</code>, then paste the endpoint&apos;s
          signing secret. Requests are
          verified with Stripe&apos;s signature, and the secret is stored encrypted.
        </p>
        <ul>
          <li>
            <strong>Matching users.</strong> Set <code>metadata.user_id</code> (or <code>fiscallm_user_id</code>) on the Stripe subscription or customer to
            the same user ID your backend sends with each AI call. Without it, the Stripe customer ID (<code>cus_…</code>) is used, so send that as the{" "}
            <code>userId</code> instead.
          </li>
          <li>
            <strong>What it counts.</strong> Paid invoices as purchases and renewals, trials and the first payment after one as a conversion, auto-renew
            switched off as a cancellation, the end of a subscription, refunds (only the new part of each partial refund), and lost disputes (as a
            refund; won disputes change nothing; needs the read-only key below, since Stripe&apos;s dispute event doesn&apos;t say who paid). Plan changes mid-cycle count as renewals, and the product and period come from the
            subscription line, not proration lines.
          </li>
          <li>
            <strong>What you keep</strong> is the payment minus tax minus Stripe&apos;s fee. Without a key, the fee is estimated (2.9% + $0.30) and
            only USD payments count. Save a read-only restricted key on the Setup page (Read on Invoices, Charges and Refunds, PaymentIntents,
            Balance transactions, Subscriptions) and FiscaLLM reads the exact fee and the USD amount each payment settled for, so payments in other
            currencies count too, as long as your Stripe account settles in USD. The key is stored encrypted and can only read.
          </li>
          <li>
            <strong>Not counted.</strong> Credit notes that only add customer balance (they lower later invoices, which is counted), failed payments,
            zero-amount invoices, the $15 dispute fee, and accounts that settle in a currency other than USD. If a number doesn&apos;t match your Stripe dashboard, <a href="https://github.com/magna56/fiscallm/issues">report anything off</a>.
          </li>
        </ul>
        <h3 id="stripe-import">Import past Stripe payments</h3>
        <p>
          The webhook sees only new events. To include the last 12 months, create a Stripe restricted key with <em>Read</em> access to Invoices, Charges
          and Refunds, and Subscriptions, and paste it under Setup → Import the last 12 months. FiscaLLM imports paid invoices, refunds, current trials
          and ended subscriptions through the same rules as the webhook. The key is used for that import only and is never stored; you can delete it in
          Stripe once the numbers appear. An invoice is counted once whether it came from the webhook or the import, so running the import again is
          safe.
        </p>

        <h2 id="revenue-api">Revenue without RevenueCat</h2>
        <p>
          If your app does not use RevenueCat, or some payments go through another system (Stripe on the web, your own App Store server
          notifications), send them yourself. They count exactly like RevenueCat events. Use one source per payment: sending the same payment
          from RevenueCat and the API counts it twice.
        </p>
        <pre>
          <code>{`meter.trackRevenue({
  id: invoice.id,              // unique; retries are ignored
  userId,                      // same id you pass to trackOpenAI
  type: "renewal",             // trial_started | purchase | renewal | refund | cancellation | expiration
  productId: "pro_monthly",
  amountUsd: 9.99,             // gross, USD; required for purchase, renewal, refund
  feePct: 0.15, taxPct: 0.1,   // or netUsd: 7.49
  periodEnd: subscription.current_period_end,
  isTrialConversion: true,     // first paid period after a trial
});

# Python
meter.track_revenue(id=invoice.id, user_id=user_id, type="purchase",
                    amount_usd=9.99, net_usd=7.49, period_end=period_end)`}</code>
        </pre>
        <p>
          Or <code>POST https://fiscallm.com/api/v1/revenue</code> with <code>{`{ "events": [ … ] }`}</code> and the same fields, using your
          ingest key. Use <code>oneTime: true</code> for lifetime or credit purchases, and <code>amountUsd</code> as a positive number for
          refunds.
        </p>

        <h3 id="revenue-csv">Upload revenue as CSV</h3>
        <p>
          For payments that never went through a webhook (an export from Stripe, Paddle, Lemon Squeezy, or a spreadsheet), upload a CSV on the Setup
          page. One row per event, with the same fields as the revenue API:
        </p>
        <pre>
          <code>{`id,user_id,type,ts,amount_usd,net_usd,product_id,period_end
in_001,user_42,purchase,2026-10-01,20,17.12,pro_monthly,2026-11-01
in_002,user_42,renewal,2026-11-01,20,17.12,pro_monthly,2026-12-01
re_001,user_7,refund,2026-10-12,20,20,pro_monthly,`}</code>
        </pre>
        <p>
          Required: <code>id</code>, <code>user_id</code>, <code>type</code>, <code>ts</code> (a date or ISO time), and <code>amount_usd</code> for
          purchases, renewals and refunds. Optional: <code>net_usd</code>, <code>tax_pct</code>, <code>fee_pct</code>, <code>product_id</code>,{" "}
          <code>period_end</code>, <code>is_trial_conversion</code>, <code>one_time</code>. Common names such as <code>customer</code>,{" "}
          <code>date</code> and <code>amount</code> are understood too. Up to about 5,000 rows per file; rows with a problem are skipped and listed by
          line number, and uploading the same rows again does not count them twice.
        </p>

        <h2 id="prices">Prices</h2>
        <p>
          Cost is calculated on our side from the providers&apos; public list prices, including cached tokens, cache writes and long-prompt pricing, and
          the price that applied on the day of each call. If you pay less, add a discount for a provider or your own prices for a model under Settings
          → Your AI prices. Models without a price are listed there too; their cost counts as zero until you add one or send <code>costUsd</code>.
        </p>
        <p>
          The same table ships in the TypeScript SDK (0.7.0 and later) for your own code, with no network call:
        </p>
        <pre>
          <code>{`import { estimateCost, priceOf } from "fiscallm/prices";

priceOf("gpt-4o"); // { provider: "openai", input: 2.5, cached: 1.25, output: 10, … } USD per 1M tokens
estimateCost({ model: "claude-sonnet-4-5", inputTokens: 12_000, outputTokens: 800 })?.costUsd;`}</code>
        </pre>
        <p>
          It is as current as the package version you installed. For prices that are always current, use the{" "}
          <Link href="/llm-pricing/api">pricing API</Link>.
        </p>

        <h2 id="alerts">Budgets and alerts</h2>
        <p>
          In Settings → Budgets and alerts, get an email, a Slack message or a webhook when a user&apos;s AI cost passes a budget (today or over
          30 days), a user uses more tokens in 5 minutes than you allow (a runaway loop), a paying user loses you more than a set amount, AI cost
          passes a share of revenue, the app&apos;s daily spend passes a limit, or a model without a price appears. Per-user budgets and the
          5-minute limit are checked within seconds of usage arriving; the others once a day. Each alert fires at most once per user (or app) per
          day.
        </p>
        <p>
          <strong>Slack:</strong> create an incoming webhook in Slack (Apps → Incoming Webhooks), and paste its URL (
          <code>https://hooks.slack.com/services/…</code>) as the alert&apos;s webhook. FiscaLLM then posts a plain message with a link to the
          dashboard. &quot;Send test&quot; shows how it looks.
        </p>
        <p>Other webhooks are a signed JSON POST your backend can act on, for example to slow down or pause a user over budget:</p>
        <pre>
          <code>{`POST <your URL>
X-FiscaLLM-Signature: t=1792200000,v1=5f2c…

{
  "type": "alert.user_daily_cost",
  "appId": "…", "ruleId": "…",
  "userId": "rc-app-user-id",
  "value": 6.12, "threshold": 5,
  "period": "2026-10-17",
  "message": "User rc-app-user-id spent $6.12 on AI today (budget $5.00)."
}`}</code>
        </pre>
        <p>
          Verify it with the signing secret shown in Settings: <code>v1</code> is the hex HMAC-SHA256 of <code>{"`${t}.${rawBody}`"}</code>.
        </p>
        <pre>
          <code>{`// TypeScript (Node)
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(rawBody: string, header: string, secret: string) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300;
  return fresh && timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

# Python
import hmac, hashlib, time

def verify(raw_body: bytes, header: str, secret: str) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(","))
    expected = hmac.new(secret.encode(), f"{parts['t']}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return abs(time.time() - int(parts["t"])) < 300 and hmac.compare_digest(expected, parts["v1"])`}</code>
        </pre>

        <h2 id="plan-limits">Limits by plan</h2>
        <p>
          Give each plan its own AI allowance: 20 calls a day on free, 500 a month on Pro, $5 of AI a month on any paid plan. FiscaLLM knows each
          user&apos;s plan from <a href="#revenuecat">RevenueCat</a> or <a href="#stripe">Stripe</a>, counts their AI calls and cost, and tells your
          backend whether to allow the next call and how much is left. You keep no quota table and no reset job. Full guide:{" "}
          <Link href="/guides/ai-usage-limits-by-plan">AI usage limits per subscription plan</Link>.
        </p>
        <ol>
          <li>
            In the app, open <strong>Limits</strong> and add a limit: a plan, a period (a day, a month, or in total), and a number of AI calls, an
            amount in USD, or both.
          </li>
          <li>Ask before each AI call, and track the call as usual:</li>
        </ol>
        <pre>
          <code>{`const { allow, plan, limits } = await meter.check(userId);
if (!allow) return respond(402, { paywall: true, plan, resetsAt: limits[0]?.resetsAt });

const reply = await openai.chat.completions.create({ ... });
meter.trackOpenAI(reply, { userId });
return { reply, remaining: limits[0]?.remaining };      // show "3 left today" in the app

# Python
r = meter.check(user_id)          # await meter.acheck(user_id) in async code
if not r.allow:
    return paywall(r.plan, r.limits[0].resets_at)`}</code>
        </pre>
        <table>
          <thead>
            <tr>
              <th>Plan name</th>
              <th>Who it covers</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>free</code>
              </td>
              <td>Anyone without an active purchase, including users whose subscription ended</td>
            </tr>
            <tr>
              <td>
                <code>trial</code>
              </td>
              <td>Users in a free trial. Without a trial limit they get their product&apos;s limits</td>
            </tr>
            <tr>
              <td>
                <code>paid</code>
              </td>
              <td>Every paying user, including one who cancelled but still has time left</td>
            </tr>
            <tr>
              <td>A product ID</td>
              <td>
                Users on that product, for example <code>pro_yearly</code>. Overrides <code>paid</code> for them
              </td>
            </tr>
          </tbody>
        </table>
        <ul>
          <li>
            <strong>Periods</strong>: a day and a month are UTC (the month is the calendar month); <code>resetsAt</code> says when the count starts
            again. &quot;In total&quot; never resets, for &quot;5 free tries, then subscribe&quot;.
          </li>
          <li>
            <strong>What counts</strong>: one tracked event is one AI call. If one message in your app makes several model calls, limit by USD
            instead, or set the number of calls accordingly.
          </li>
          <li>
            <strong>Your own plans</strong>: if your database knows the plan better than RevenueCat or Stripe (teams, promo access, no billing
            connected), pass it: <code>meter.check(userId, {"{ plan: \"team\" }"})</code> (<code>plan=&quot;team&quot;</code> in Python) and add a limit
            for <code>team</code>.
          </li>
          <li>
            <strong>A renewal that arrives late</strong> does not drop a paying user to the free limits: a subscription counts as paid for a day
            past its end date.
          </li>
          <li>
            <strong>How exact it is</strong>: usage counts once the call is tracked, so a user can go slightly over with calls made at the same
            moment. The SDK counts each tracked call against its remembered answer at once, so &quot;3 left&quot; becomes &quot;2 left&quot; right
            away; the server&apos;s number follows within seconds.
          </li>
          <li>
            The <strong>Limits</strong> page lists who is at a limit right now. Free users on that list are the ones most likely to pay for more.
          </li>
          <li>Everything under <a href="#caps">Spending caps</a> about outages, caching and the local limit applies here too.</li>
        </ul>
        <p>Without the SDK:</p>
        <pre>
          <code>{`POST https://fiscallm.com/api/v1/check
Authorization: Bearer fsk_…
{ "userId": "rc-app-user-id" }            // optional: "plan": "team"

200 { "allow": false, "reason": "free plan limit reached (20 of 20 AI calls today)",
      "plan": "free", "productId": null, "limitsFrom": "free",
      "limits": [{ "period": "day", "unit": "requests", "limit": 20, "used": 20,
                   "remaining": 0, "resetsAt": "2026-11-12T00:00:00.000Z" }],
      "spentToday": 0.21, "spent30d": 1.9, "dailyLimit": null, "monthlyLimit": null }`}</code>
        </pre>

        <h2 id="caps">Spending caps</h2>
        <p>
          Alerts tell you; caps let your backend say no. When you add a daily or 30-day per-user budget in Settings, tick <strong>Block</strong>.
          Your backend then asks FiscaLLM before each AI call, and refuses the user (or switches to a cheaper model) once they reach the amount:
        </p>
        <pre>
          <code>{`const { allow, reason } = await meter.check(userId);
if (!allow) return respond(429, "You have reached today's AI limit");

// or keep them going on a cheaper model instead of refusing
const model = allow ? "gpt-5" : "gpt-5-mini";

# Python
r = meter.check(user_id)          # await meter.acheck(user_id) in async code
if not r.allow:
    return refuse(r.reason)`}</code>
        </pre>
        <ul>
          <li>
            <strong>If FiscaLLM is slow or down</strong> (over 1.5 seconds, an error, or a wrong key): a user FiscaLLM already refused stays refused
            until it says otherwise, so a capped user cannot slip through an outage. Anyone else is allowed by default; set{" "}
            <code>checkOnError: &quot;deny&quot;</code> (<code>check_on_error=&quot;deny&quot;</code> in Python) to refuse instead. The result&apos;s{" "}
            <code>source</code> says which case applied.
          </li>
          <li>
            <strong>Local limit</strong>: a guard that needs no network at all. The SDK counts each user&apos;s AI calls, tokens and exact costs in
            your process, and <code>check</code> refuses past the limit, so a runaway loop is stopped even while FiscaLLM is unreachable:
            <pre>
              <code>{`createMeter({ apiKey, localLimit: { requests: 60, tokens: 500_000, windowSeconds: 300 } })

# Python
Meter(api_key, local_limit=LocalLimit(requests=60, tokens=500_000, window_seconds=300))`}</code>
            </pre>
            It counts only calls tracked by this process, so with several servers each one enforces it separately. <code>costUsd</code> counts only
            events tracked with an exact cost.
          </li>
          <li>The answer is cached for 5 seconds in the SDK and 10 seconds on the server, so a busy backend does not ask on every request.</li>
          <li>
            It is based on the cost already recorded, so a user can go a little over the amount before they are refused (a few seconds of usage,
            and any call still running). It is a guard against runaway cost, not a billing system.
          </li>
          <li>Only budgets marked Block can refuse a user. Without any, <code>check</code> always allows.</li>
          <li>Turned off by the kill switch below: the meter then allows every call.</li>
        </ul>
        <p>Without the SDK:</p>
        <pre>
          <code>{`POST https://fiscallm.com/api/v1/check
Authorization: Bearer fsk_…
{ "userId": "rc-app-user-id" }

200 { "allow": false, "reason": "daily AI budget reached ($6.12 of $5.00)",
      "spentToday": 6.12, "spent30d": 26.4, "dailyLimit": 5, "monthlyLimit": null }`}</code>
        </pre>

        <h2 id="jobs">Jobs, holds and refunds</h2>
        <p>
          For apps that charge per job (credits for a video render, an image, a report): tag the job&apos;s AI calls with your job id, and report
          what happened to the user&apos;s payment. The <strong>Jobs</strong> page then shows the AI cost of jobs you refunded, and of jobs that
          never resolved, per user.
        </p>
        <pre>
          <code>{`meter.trackJob({ jobId, userId, status: "pending" });   // credits held, job started
meter.track({ userId, provider: "fal", model: "veo-3", units: 15, unit: "second", jobId });
meter.trackJob({ jobId, userId, status: "captured" });  // clip stored, credits taken
// or, on a definite failure:
meter.trackJob({ jobId, userId, status: "refunded" });  // credits returned

# Python
meter.track(user_id=user_id, provider="fal", model="veo-3", units=15, unit="second", job_id=job_id)
meter.track_job(job_id=job_id, user_id=user_id, status="refunded")`}</code>
        </pre>
        <ul>
          <li>
            <code>jobId</code> also works on <code>trackOpenAI</code>, <code>trackStream</code> and the other helpers (<code>job_id</code> in
            Python).
          </li>
          <li>
            The newest status wins. A late <code>pending</code> never reopens a job that was captured or refunded, so retries and out-of-order
            deliveries are safe.
          </li>
          <li>
            A job with no captured or refunded status an hour after its last event counts as <strong>unresolved</strong>: cost you may have paid
            without charging the user. After a timeout, track the cost once you learn the provider billed it, and report the outcome when you
            reconcile.
          </li>
          <li>Job cost is already part of each user&apos;s margin. The Jobs page shows how much of it bought nothing the user paid for.</li>
          <li>
            <strong>Failed but billed:</strong> a failed job often returns no usage, so it is easy to skip tracking it. If the provider still
            charged you, track the call anyway, with its units or the exact cost, then report the refund. If the provider did not charge you,
            report only the refund; the job then shows $0 cost.
          </li>
        </ul>
        <pre>
          <code>{`// The render failed; the user gets their credits back, but the provider billed it.
meter.track({ userId, provider: "fal", model: "veo-3", units: 15, unit: "second", jobId });
// or, if you know the exact charge:
meter.track({ userId, provider: "fal", model: "veo-3", costUsd: 0.75, jobId });
meter.trackJob({ jobId, userId, status: "refunded" });`}</code>
        </pre>
        <ul>
          <li>Without the SDK: <code>{`POST /api/v1/jobs { "jobs": [{ "jobId", "userId", "status", "ts"? }] }`}</code>, up to 100 per request.</li>
        </ul>

        <h2 id="api">Ingest API</h2>
        <p>For backends not written in TypeScript, send events directly:</p>
        <pre>
          <code>{`POST https://fiscallm.com/api/v1/events
Authorization: Bearer <FISCALLM_KEY>
Content-Type: application/json

{
  "events": [{
    "id": "9b2c6f0e-3f7c-4d8a-9a51-2f0a4f1c7e21",   // a UUID you generate; retries reuse it
    "userId": "rc-app-user-id",
    "ts": "2026-10-17T12:00:00Z",
    "provider": "openai",
    "model": "gpt-5-mini",
    "inputTokens": 1200,       // excluding cache reads and writes
    "outputTokens": 300,
    "cachedTokens": 0,
    "cacheWriteTokens": 0,
    "units": 12.5,             // optional, with "unit": "minute" | "second" | "character" | "image"
    "costUsd": 0.0012,         // optional: overrides our price
    "feature": "chat"          // optional
  }]
}`}</code>
        </pre>
        <p>
          Up to 100 events per request. The response is <code>202</code> with <code>{`{ accepted, duplicates, unpriced }`}</code>. Events with an
          <code>id</code> already received are counted as duplicates and ignored, so retrying is safe. Timestamps may be up to 90 days old.
        </p>

        <h2 id="read-api">Read API</h2>
        <p>
          The dashboard&apos;s numbers as JSON, for scripts, internal tools and AI agents. Send the same key. Each takes <code>?days=</code> (1 to 365,
          default 30).
        </p>
        <pre>
          <code>{`GET https://fiscallm.com/api/v1/metrics/overview     cost, revenue, margin, AI's share of revenue, daily series
GET https://fiscallm.com/api/v1/metrics/users        per user, worst margin first   (&limit=50, &losing=1 for only users losing money)
GET https://fiscallm.com/api/v1/metrics/plans        per plan or product
GET https://fiscallm.com/api/v1/metrics/breakdown    cost by model and by feature
Authorization: Bearer <FISCALLM_KEY>`}</code>
        </pre>
        <pre>
          <code>{`curl -H "Authorization: Bearer $FISCALLM_KEY" "https://fiscallm.com/api/v1/metrics/users?days=30&losing=1"`}</code>
        </pre>
        <p>
          AI assistants can read the same numbers through the <a href="/mcp">MCP server</a>. Model prices and cost estimates are a separate{" "}
          <Link href="/llm-pricing/api">public API</Link> that needs no key. Everything is described in <a href="/openapi.json">openapi.json</a>.
        </p>

        <h2 id="kill-switch">Kill switch</h2>
        <p>
          To turn reporting off without a deploy, set <code>FISCALLM_DISABLED=1</code> in your environment, or pass <code>disabled: true</code> (TypeScript)
          or <code>disabled=True</code> (Python) when you create the meter. A disabled meter does nothing: nothing is queued or sent, and streams and
          responses pass through untouched. See <a href="/coverage">what FiscaLLM covers and what it doesn&apos;t</a>.
        </p>

        <h2 id="limits">Limits</h2>
        <p>
          The hosted service accepts up to 100,000 events per app per calendar month (UTC). After that the API answers 403 until the 1st, and the SDKs print
          the message once. Self-hosted copies have no limit by default. Need more? <a href="https://github.com/magna56/fiscallm/issues">Open an issue</a> or
          self-host.
        </p>

        <h2 id="data">Data and retention</h2>
        <ul>
          <li>Raw AI events are kept 90 days; daily totals per user are kept until you delete them.</li>
          <li>Settings → Danger zone deletes all of an app&apos;s data, or the app itself.</li>
          <li>
            See the <a href="/privacy">privacy policy</a> for details.
          </li>
        </ul>
      </Prose>
      <SiteFooter />
    </div>
  );
}
