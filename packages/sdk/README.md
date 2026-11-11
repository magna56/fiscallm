# fiscallm

Limit AI usage by subscription plan, and track the AI cost of each user of your app against their subscription revenue from RevenueCat, Stripe or any billing system.
Zero dependencies. Runs on Node 20+, Cloudflare Workers, Vercel, Supabase Edge Functions (Deno), Bun and Firebase.

The SDK never sits in the path of your AI calls: it reports token counts in the background, never throws, and gives up after one retry. Prompts and responses are never sent.

```sh
npm install fiscallm
```

```ts
import { createMeter } from "fiscallm";

const meter = createMeter({
  apiKey: process.env.FISCALLM_KEY,
  // Optional: send after your response. Workers: ctx.waitUntil.bind(ctx)
  waitUntil,
});

// userId: the same ID your billing knows the user by (RevenueCat app user ID,
// or metadata.user_id on the Stripe subscription).
const res = await openai.chat.completions.create({ model, messages });
meter.trackOpenAI(res, { userId, feature: "chat" });

meter.trackAnthropic(message, { userId });
meter.trackGemini(result, { userId });

// Streams: chunks pass through unchanged.
const stream = meter.trackStream(
  await openai.chat.completions.create({ model, messages, stream: true, stream_options: { include_usage: true } }),
  { userId },
);

// Raw provider fetch streamed straight to the app (e.g. a Worker proxy):
return meter.trackSSE(await fetch(providerUrl, init), { userId });

// Priced per unit (FiscaLLM knows the price): minutes, seconds, characters, images
meter.track({ userId, provider: "openai", model: "whisper-1", units: 12.5, unit: "minute" });
meter.track({ userId, provider: "google", model: "veo-3.1-fast-generate-preview", units: 8, unit: "second", variant: "1080p" });

// Anything else: the exact cost
meter.track({ userId, provider: "fal", model: "flux", costUsd: 0.04 });

// Not on RevenueCat or Stripe? Report payments yourself:
meter.trackRevenue({ id: invoice.id, userId, type: "renewal", amountUsd: 9.99, feePct: 0.15 });

// Pay-per-job apps (credits held, then charged or returned): tag the job's
// calls, report the outcome, and the Jobs page shows the cost of refunded
// or never-resolved jobs per user. Track a failed job's cost too if the
// provider still billed it.
meter.trackJob({ jobId, userId, status: "pending" });
meter.track({ userId, provider: "fal", model: "veo-3", units: 15, unit: "second", jobId });
meter.trackJob({ jobId, userId, status: "captured" }); // or "refunded"

// Serverless without waitUntil (e.g. Firebase): before returning
await meter.flush();
```

## Limits by plan

Give each plan its own AI allowance on the app's Limits page (for example `free`: 10 AI calls a day; `pro_monthly`: 500 a month; `paid`: $8 of AI a month). FiscaLLM knows each user's plan from RevenueCat or Stripe. Ask before each AI call:

```ts
const { allow, plan, limits } = await meter.check(userId);
if (!allow) return respond(402, { paywall: true, plan, resetsAt: limits?.[0]?.resetsAt });

const res = await openai.chat.completions.create({ model, messages });
meter.trackOpenAI(res, { userId });
return { reply, remaining: limits?.[0]?.remaining }; // "3 left today"
```

Each entry of `limits` has `period` (`"day"`, `"month"` or `"total"`), `unit` (`"requests"` or `"usd"`), `limit`, `used`, `remaining` and `resetsAt`. Your own plan names: `meter.check(userId, { plan: "team" })`. The answer is cached for 5 seconds, and each tracked call is counted against it at once. [Docs](https://fiscallm.com/docs#plan-limits)

## Prices without a network call

The price table FiscaLLM uses (OpenAI, Anthropic and Google list prices, USD per million tokens) is in the package:

```ts
import { estimateCost, listPrices, priceOf } from "fiscallm/prices";

priceOf("gpt-4o"); // { provider: "openai", model: "gpt-4o", input: 2.5, cached: 1.25, output: 10, … }
estimateCost({ model: "claude-sonnet-4-5", inputTokens: 12_000, outputTokens: 800, cachedTokens: 10_000 })?.costUsd;
listPrices(); // every current text model, cheapest input first
```

`inputTokens` is the whole prompt, including cached tokens. `"openai/gpt-4o"` and dated snapshots match too; an unknown model returns `undefined` or `null`. The table is as current as the version you installed (`PRICES_CHECKED` is the date of the last audit); for prices that are always current, call the free [pricing API](https://fiscallm.com/llm-pricing/api).

OpenAI-compatible APIs work with `trackOpenAI(res, { userId, provider: "groq" })`.
