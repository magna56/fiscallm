---
name: fiscallm-setup
description: Set up FiscaLLM in this codebase, so each user's AI usage is reported, matched to their RevenueCat or Stripe subscription, and can be limited by plan. Use when the user asks to add, install, set up or connect FiscaLLM, to limit AI usage per plan or per user (free tier, message quota, paywall when the quota is used up), or to track AI cost or margin per user.
---

# Set up FiscaLLM

FiscaLLM shows the AI cost of each user of a mobile subscription app next to the revenue from that user. The backend reports token usage with a small SDK; RevenueCat sends subscription events by webhook. Docs: https://fiscallm.com/docs

Your job: add usage reporting to this codebase's backend, carry the RevenueCat app user ID through to it, and tell the user the two settings only they can make. Work through the steps in order and show the user a short plan before editing.

## Rules

- Never send prompts, responses or message content to FiscaLLM. The SDK only reads token counts from responses; do not pass anything else.
- Never write the ingest key into code or commit it. Read it from an environment variable named `FISCALLM_KEY`.
- Reporting must never break or slow the app. Do not `await` tracking calls except `meter.flush()` where noted, and do not wrap AI calls in new error handling for it.
- Change as little as possible: one `createMeter` per runtime entry point and one tracking call after each AI call.

## 1. Find the AI calls

Search the backend for calls to AI providers:

- OpenAI and compatible APIs: `chat.completions.create`, `responses.create`, `api.openai.com`, Groq, OpenRouter, DeepSeek, Together
- Anthropic: `messages.create`, `messages.stream`, `api.anthropic.com`
- Gemini: `generateContent`, `generateContentStream`, `generativelanguage.googleapis.com`
- Anything else billed per call (images, voice, embeddings providers)

List each call with its file, provider, whether it streams, and how the response is used. If AI is only called from the mobile app with no backend in between, stop and tell the user FiscaLLM needs a backend for now.

Language: if the backend is TypeScript or JavaScript, use the npm package below. If it is Python, use `pip install fiscallm` (see the Python section). For anything else, use the HTTP API in the docs.

## 1b. Is usage already recorded? Then skip the SDK

Check for these before installing anything. If one is present, use it and skip steps 2, 3 and 5 (still do step 4: the user ID must be the one billing knows).

- **OpenTelemetry tracing of AI calls** (`@opentelemetry/*`, `@vercel/otel`, `@ai-sdk/otel`, `experimental_telemetry`, OpenLLMetry / `traceloop`, OpenInference): add one more OTLP/HTTP trace exporter with URL `https://fiscallm.com/api/v1/otel/v1/traces` and header `Authorization: Bearer ${FISCALLM_KEY}` (in the OpenTelemetry Collector: an `otlphttp` exporter with endpoint `https://fiscallm.com/api/v1/otel`). Keep the existing exporter. Make sure every AI call span carries a `user.id` attribute; with the Vercel AI SDK 7 use `new OpenTelemetry({ enrichSpan: ({ runtimeContext }) => ({ "user.id": runtimeContext?.userId }) })` and pass `runtimeContext: { userId }` with `telemetry: { includeRuntimeContext: { userId: true } }` on each call. Details: https://fiscallm.com/integrations/opentelemetry and https://fiscallm.com/integrations/vercel-ai-sdk
- **A LiteLLM proxy** (`config.yaml` with `model_list`): add this to the config, and make sure requests send `user`. Details: https://fiscallm.com/integrations/litellm

  ```yaml
  litellm_settings:
    callbacks: ["fiscallm"]
  callback_settings:
    fiscallm:
      callback_type: generic_api
      endpoint: https://fiscallm.com/api/v1/litellm
      headers:
        Authorization: os.environ/FISCALLM_KEY
  ```

Spans and logs with no user ID are skipped, and the response says how many.

## 2. Install and create the meter

```sh
npm install fiscallm
```

Create one meter per request (serverless) or one per process (long-running server), with the platform's way of finishing work after the response:

| Platform | createMeter options | Notes |
|---|---|---|
| Cloudflare Workers | `{ apiKey: env.FISCALLM_KEY, waitUntil: ctx.waitUntil.bind(ctx) }` | create inside `fetch(request, env, ctx)` |
| Vercel functions | `{ apiKey: process.env.FISCALLM_KEY, waitUntil }` | `import { waitUntil } from "@vercel/functions"` |
| Supabase Edge Functions | `{ apiKey: Deno.env.get("FISCALLM_KEY"), waitUntil: (p) => EdgeRuntime.waitUntil(p) }` | import from `npm:fiscallm` |
| Firebase Functions, AWS Lambda | `{ apiKey: process.env.FISCALLM_KEY }` | `await meter.flush()` before returning the response |
| Node server (Express, Fastify, Hono on Node) | `{ apiKey: process.env.FISCALLM_KEY }` | create once at startup; sends every 2 seconds |

```ts
import { createMeter } from "fiscallm";
```

## 3. Track each AI call

Right after each call, with the user's RevenueCat app user ID:

```ts
const res = await openai.chat.completions.create({ model, messages });
meter.trackOpenAI(res, { userId, feature: "chat" });

meter.trackAnthropic(message, { userId, feature: "summary" });
meter.trackGemini(result, { userId, feature: "chat" });

// OpenAI-compatible APIs
meter.trackOpenAI(res, { userId, provider: "groq" });

// Priced per unit: minutes of audio, characters of speech, seconds of video, images
meter.track({ userId, provider: "openai", model: "whisper-1", units: durationSeconds / 60, unit: "minute" });
meter.track({ userId, provider: "openai", model: "tts-1", units: input.length, unit: "character" });
meter.track({ userId, provider: "google", model: "veo-3.1-fast-generate-preview", units: seconds, unit: "second", variant: "1080p" });

// Other providers not priced per token: pass the exact cost
meter.track({ userId, provider: "fal", model: "flux-pro", costUsd: 0.05, feature: "image" });
```

`feature` is a short label for what the call does in the app ("chat", "summary", "image"); pick one per call site.

Streaming:

```ts
// SDK streams: wrap the stream, use the returned one
const stream = meter.trackStream(
  await openai.chat.completions.create({ ...params, stream: true, stream_options: { include_usage: true } }),
  { userId },
);

// Raw provider fetch piped to the app (e.g. a proxy Worker): wrap the Response
return meter.trackSSE(await fetch(providerUrl, init), { userId });
```

OpenAI Chat Completions streams report no usage unless `stream_options: { include_usage: true }` is set; add it.

## 4. Use the RevenueCat app user ID

The `userId` must be the user's RevenueCat app user ID, or costs cannot be matched to revenue.

1. Find how the backend identifies the user today (auth token, request body, header).
2. Find how the app configures RevenueCat (`Purchases.configure`, `logIn`).
   - If the app logs in to RevenueCat with its own user IDs and the backend knows the same ID, use it directly.
   - If the app uses RevenueCat's anonymous IDs, send the RevenueCat ID from the app to the backend with each AI request, for example in a header `x-rc-app-user-id`:
     - iOS (Swift): `Purchases.shared.appUserID`
     - Android (Kotlin): `Purchases.sharedInstance.appUserID`
     - React Native: `await Purchases.getAppUserID()`
     - Flutter: `await Purchases.appUserID`
     - Web: `Purchases.getSharedInstance().getAppUserId()`
3. Pass that value as `userId` in every tracking call.

## 4b. No RevenueCat?

If the app bills through Stripe, tell the user to connect Stripe from the app's Setup page (a webhook, no code) and set `metadata.user_id` on Stripe subscriptions to the same user ID the backend sends. Suggest saving a read-only restricted key there too: it imports the last 12 months, uses Stripe's exact fee, counts other currencies and lost disputes (https://fiscallm.com/stripe). For other billing systems (its own App Store or Play server notifications), find where payments are confirmed (webhook handlers for invoice paid, refunds, subscription changes) and report each one, using the same userId as the AI calls:

```ts
meter.trackRevenue({ id: invoice.id, userId, type: "renewal", productId, amountUsd: invoice.amount_paid / 100, feePct: 0.03, periodEnd });
// type: trial_started | purchase | renewal | refund | cancellation | expiration
```

Do not report payments RevenueCat already sends; they would count twice.

## 5. Python

```sh
pip install fiscallm
```

```python
from fiscallm import Meter

meter = Meter(api_key=os.environ["FISCALLM_KEY"])  # one per process

res = client.chat.completions.create(model=model, messages=messages)
meter.track_openai(res, user_id=user_id, feature="chat")
# also: meter.track_anthropic, meter.track_gemini,
# meter.track(user_id=..., provider="openai", model="whisper-1", units=minutes, unit="minute")
# meter.track_revenue(id=..., user_id=..., type="purchase", amount_usd=9.99)  # without RevenueCat
```

Serverless (Lambda, Cloud Functions): call `meter.flush()` before returning. Streams: `meter.track_stream(stream, user_id=user_id)` returns a stream to iterate instead.

## 5a. Optional: limits by plan (free, trial, paid)

If the user wants each plan to have its own AI allowance (for example 10 AI messages a day on free, 500 a month on Pro), call `check` before the AI call and keep tracking the call as in step 5. FiscaLLM knows the plan from RevenueCat or Stripe; a user with no purchase is `free`.

```ts
const { allow, plan, limits } = await meter.check(userId);
if (!allow) return Response.json({ paywall: true, plan, resetsAt: limits?.[0]?.resetsAt }, { status: 402 });

const res = await openai.chat.completions.create({ model, messages });
meter.trackOpenAI(res, { userId });
return Response.json({ reply, remaining: limits?.[0]?.remaining });
```

Python: `r = meter.check(user_id)` (`await meter.acheck(user_id)` in async code), then `r.allow`, `r.plan`, `r.limits[0].remaining`, `r.limits[0].resets_at`.

- Each entry of `limits` has `period` (`day`, `month` or `total`), `unit` (`requests` or `usd`), `limit`, `used`, `remaining` and `resetsAt`. Days and months are UTC.
- One tracked event counts as one AI call. If one user action makes several model calls, tell the user to limit by USD or set the number accordingly.
- If the codebase has its own plan names (teams, promo access, no RevenueCat or Stripe), pass the plan: `meter.check(userId, { plan: "team" })` (`plan="team"` in Python).
- Return the remaining number to the client so it can show "3 left today"; do not enforce the limit in the client.
- Tell the user the one thing only they can do: open the app's **Limits** page in the dashboard and add a limit per plan (plan `free`, `trial`, `paid` or a product ID; a period; AI calls and/or USD). Without any limit, `check` allows every call.

## 5b. Optional: block users over budget

If the user wants to stop a user who reached their budget (not just be alerted), call `check` before the AI call. If FiscaLLM is unreachable, users it already refused stay refused and others are allowed (set `checkOnError: "deny"` to refuse instead). For runaway loops, `createMeter({ apiKey, localLimit: { requests: 60, windowSeconds: 300 } })` adds an in-process limit that needs no network:

```ts
const { allow, reason } = await meter.check(userId);
if (!allow) return new Response(reason, { status: 429 });
```

Python: `r = meter.check(user_id)` (`await meter.acheck(user_id)` in async code). The user must also add a daily or 30-day budget in Settings and tick "Block". Only add this if they asked for it.

## 5c. Optional: pay-per-job apps

If the app charges per job (credits held when a job starts, then taken or returned), pass the job id on each AI call and report the outcome. Only add this if the app works this way:

```ts
meter.trackJob({ jobId, userId, status: "pending" });   // credits held
meter.track({ userId, provider, model, units: 15, unit: "second", jobId }); // or trackOpenAI(res, { userId, jobId })
meter.trackJob({ jobId, userId, status: "captured" });  // or "refunded" when credits go back
```

Python: `job_id=` on `track`/`track_openai`/etc., and `meter.track_job(job_id=..., user_id=..., status=...)`. If a failed job was still billed by the provider, track its cost anyway (units or `costUsd`) before reporting "refunded". Needs SDK 0.5.0 or later.

## 5d. Optional: read the numbers back

With the same key, `GET https://fiscallm.com/api/v1/metrics/overview`, `/users`, `/plans` and `/breakdown` (`?days=30`) return cost, revenue and margin as JSON. Assistants can use the read-only MCP server at `https://fiscallm.com/api/mcp` (send the key as `Authorization: Bearer <key>` for the margin tools; the price tools need no key). Never write the key into an MCP config file that is committed.

## 6. Finish

Tell the user, briefly:

1. Add `FISCALLM_KEY` to the backend's environment (the ingest key from https://fiscallm.com/dashboard → their app → Setup). Never commit it.
2. On the same Setup page, press **Connect RevenueCat** and approve access: FiscaLLM adds its webhook to their RevenueCat project and imports past subscribers. (Manual alternative: RevenueCat → Integrations → Webhooks → add the webhook URL and authorization value shown on the Setup page.)
3. Deploy, make one AI request, and watch the Setup page: "First AI event received" turns green within seconds.

List the files you changed and which call sites now report usage, and mention any AI calls you could not instrument and why.
