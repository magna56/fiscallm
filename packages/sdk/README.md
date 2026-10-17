# fiscallm

Track the AI cost of each user of your app against their subscription revenue.
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

// userId must be the user's RevenueCat app user ID.
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

// No RevenueCat? Report payments yourself:
meter.trackRevenue({ id: invoice.id, userId, type: "renewal", amountUsd: 9.99, feePct: 0.15 });

// Serverless without waitUntil (e.g. Firebase): before returning
await meter.flush();
```

OpenAI-compatible APIs work with `trackOpenAI(res, { userId, provider: "groq" })`.
