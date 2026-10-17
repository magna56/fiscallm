import type { Metadata } from "next";
import { SKILL_INSTALL, SKILL_PROMPT } from "@/components/ai-setup";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = {
  title: "Docs · FiscaLLM",
  description: "Set up FiscaLLM: the SDK, RevenueCat, user IDs, prices and the ingest API.",
};

export default function DocsPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <Prose>
        <h1>Docs</h1>
        <p>Setup takes about ten minutes: create an app, report AI usage from your backend, and connect RevenueCat.</p>

        <h2 id="quickstart">Quickstart</h2>
        <ol>
          <li>
            <a href="/login">Sign in</a> and create an app. Copy the ingest key (shown once) and store it on your backend as <code>FISCALLM_KEY</code>.
          </li>
          <li>Install the SDK on your backend and track each AI call (below).</li>
          <li>Add the webhook URL from the app&apos;s Setup page to RevenueCat (below).</li>
        </ol>
        <p>The Setup page shows when the first event and the first webhook arrive, and how many of your AI users it could match to RevenueCat.</p>

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
        <ol>
          <li>In RevenueCat: Project → Integrations → Webhooks → Create new webhook.</li>
          <li>Webhook URL and Authorization header value: copy both from your app&apos;s Setup page.</li>
          <li>Environment: Production. To test with sandbox or Test Store purchases, choose both and turn on test mode in Settings.</li>
        </ol>
        <p>
          Revenue is net: price × (1 − tax − store commission), as RevenueCat reports them. Refunds subtract on the day they happen.
        </p>
        <p>
          RevenueCat sends only new events. To bring in subscribers who paid before you connected, use Settings → Import past subscribers: paste
          your RevenueCat project ID and a v2 secret key with read-only access to customer information and project configuration, and FiscaLLM imports their purchases,
          renewals and trials from RevenueCat&apos;s API. Purchases the webhook already delivered are skipped, so nothing counts twice.
          App Store and Play Store subscriptions come in renewal by renewal; for other stores (Stripe, Web Billing) RevenueCat only reports each
          subscription&apos;s total, which is counted on its start date. The key is
          stored encrypted only while the import runs.
        </p>

        <h2 id="prices">Prices</h2>
        <p>
          Cost is calculated on our side from the providers&apos; public list prices, including cached tokens, cache writes and long-prompt pricing, and
          the price that applied on the day of each call. If you pay less, add a discount for a provider or your own prices for a model under Settings
          → Your AI prices. Models without a price are listed there too; their cost counts as zero until you add one or send <code>costUsd</code>.
        </p>

        <h2 id="alerts">Budgets and alerts</h2>
        <p>
          In Settings → Budgets and alerts, get an email or a webhook when a user&apos;s AI cost passes a budget (today or over 30 days), a paying
          user loses you more than a set amount, AI cost passes a share of revenue, the app&apos;s daily spend passes a limit, or a model without
          a price appears. Per-user budgets are checked within seconds of usage arriving; the others once a day. Each alert fires at most once
          per user (or app) per day.
        </p>
        <p>Webhooks are a signed JSON POST your backend can act on, for example to slow down or pause a user over budget:</p>
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
