import { fromAnthropic, fromGemini, fromOpenAI, readSSE, StreamUsage, type Usage } from "./usage.js";

// Zero dependencies: fetch, timers and Web Crypto only, so the same code
// runs on Node 20+, Cloudflare Workers, Deno (Supabase), Bun and Vercel.


export interface TrackEvent {
  /** The RevenueCat app user ID of the person who made the request. */
  userId: string;
  /** "openai", "anthropic", "google", or any other name. */
  provider: string;
  model: string;
  /** Input tokens excluding cache reads and cache writes. */
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  /** Exact cost in USD, for calls not priced per token (images, voice). */
  costUsd?: number;
  /** Your own label, e.g. "chat" or "summary", to break cost down by. */
  feature?: string;
  /** When the call happened. Defaults to now. */
  ts?: Date | string;
}

export interface MeterOptions {
  apiKey: string | undefined;
  /**
   * Keeps the runtime alive until events are sent, so reporting happens
   * after your response. Workers: `ctx.waitUntil.bind(ctx)`. Vercel:
   * `waitUntil` from `@vercel/functions`. Supabase: `EdgeRuntime.waitUntil`.
   * Without it, call `await meter.flush()` before your function returns
   * on serverless platforms.
   */
  waitUntil?: (promise: Promise<unknown>) => void;
  endpoint?: string;
  /** Defaults to console. Pass `{ warn() {} }` to silence the SDK. */
  logger?: { warn: (message: string) => void };
}

export interface TrackContext {
  userId: string;
  feature?: string;
  /** Name an OpenAI-compatible provider, e.g. "groq" or "openrouter". */
  provider?: string;
  /** Overrides the model read from the response. */
  model?: string;
}

export interface Meter {
  /** Queues an event. Never throws and never waits on the network. */
  track(event: TrackEvent): void;
  /** Chat Completions or Responses API result, from the SDK or `res.json()`. */
  trackOpenAI(response: unknown, ctx: TrackContext): void;
  /** Messages API result, from the SDK or `res.json()`. */
  trackAnthropic(response: unknown, ctx: TrackContext): void;
  /** generateContent result, from @google/genai or `res.json()`. */
  trackGemini(response: unknown, ctx: TrackContext): void;
  /**
   * Passes a streamed result through unchanged and tracks its usage when it
   * ends. Works for OpenAI, Anthropic and Gemini SDK streams. OpenAI Chat
   * Completions needs `stream_options: { include_usage: true }`.
   */
  trackStream<T>(stream: AsyncIterable<T>, ctx: TrackContext): AsyncIterable<T>;
  /**
   * For a raw provider `fetch` that streams server-sent events. Returns an
   * equivalent Response to pass on; usage is read from a copy of the body.
   */
  trackSSE(response: Response, ctx: TrackContext): Response;
  /** Sends everything queued. Never rejects. */
  flush(): Promise<void>;
}

interface WireEvent {
  id: string;
  userId: string;
  ts: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
  costUsd?: number;
  feature?: string;
}

const DEFAULT_ENDPOINT = "https://fiscallm.com/api/v1/events";
export const MAX_BATCH = 100;
const TIMEOUT_MS = 2000;
const RETRY_DELAY_MS = 250;
// Batch window for events from one request when waitUntil is available.
const WAIT_UNTIL_DELAY_MS = 50;
// Batch window for long-running servers without waitUntil.
const INTERVAL_MS = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const count = (n: number | undefined) =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : 0;

export function createMeter(options: MeterOptions): Meter {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const logger = options.logger ?? console;
  const warned = new Set<string>();
  const warnOnce = (key: string, message: string) => {
    if (warned.has(key)) return;
    warned.add(key);
    try {
      logger.warn(`[fiscallm] ${message}`);
    } catch {}
  };

  let queue: WireEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingRelease: (() => void) | undefined;
  const inflight = new Set<Promise<void>>();
  // trackSSE copies still being read; flush() waits for them too.
  const reading = new Set<Promise<void>>();

  async function post(batch: WireEvent[]): Promise<"ok" | "retry" | "drop"> {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({ events: batch }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return "ok";
      if (res.status === 429 || res.status >= 500) return "retry";
      const detail = await res.text().catch(() => "");
      warnOnce(`http-${res.status}`, `events rejected (${res.status}): ${detail.slice(0, 300)}`);
      return "drop";
    } catch {
      return "retry";
    }
  }

  async function send(batch: WireEvent[]): Promise<void> {
    if ((await post(batch)) !== "retry") return;
    await sleep(RETRY_DELAY_MS);
    if ((await post(batch)) === "retry") {
      warnOnce("unreachable", `could not reach ${endpoint}; ${batch.length} events dropped`);
    }
  }

  function keepAlive(p: Promise<unknown>) {
    if (!options.waitUntil) return;
    try {
      options.waitUntil(p);
    } catch {
      warnOnce("waitUntil", "waitUntil threw; on Workers pass ctx.waitUntil.bind(ctx)");
    }
  }

  function sendQueued(): Promise<void> {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    // The sends below take over keeping the runtime alive.
    pendingRelease?.();
    pendingRelease = undefined;
    const sends: Promise<void>[] = [];
    while (queue.length > 0) {
      const p = send(queue.splice(0, MAX_BATCH)).catch(() => {});
      inflight.add(p);
      p.finally(() => inflight.delete(p));
      sends.push(p);
    }
    const all = Promise.all(sends).then(() => {});
    keepAlive(all);
    return all;
  }

  function schedule() {
    if (timer !== undefined) return;
    if (options.waitUntil) {
      // Keeps the runtime alive through the short batch window too.
      let release!: () => void;
      keepAlive(new Promise<void>((resolve) => (release = resolve)));
      timer = setTimeout(() => {
        timer = undefined;
        void sendQueued();
      }, WAIT_UNTIL_DELAY_MS);
      pendingRelease = release;
    } else {
      timer = setTimeout(() => {
        timer = undefined;
        void sendQueued();
      }, INTERVAL_MS);
      // Do not keep a Node process alive just for this timer.
      (timer as { unref?: () => void }).unref?.();
    }
  }

  function trackUsage(usage: Usage | null, ctx: TrackContext, source: string) {
    if (!usage) {
      warnOnce(`no-usage-${source}`, `${source}: no token usage found in the response; event skipped`);
      return;
    }
    meter.track({
      ...usage,
      userId: ctx.userId,
      feature: ctx.feature,
      provider: ctx.provider ?? usage.provider,
      model: ctx.model ?? usage.model,
    });
  }

  function finishStream(acc: StreamUsage, ctx: TrackContext, source: string) {
    if (acc.missingOpenAIUsage) {
      warnOnce(
        "no-include-usage",
        `${source}: OpenAI stream had no usage; pass stream_options: { include_usage: true }`,
      );
      return;
    }
    trackUsage(acc.usage, ctx, source);
  }

  const meter: Meter = {
    trackOpenAI(response, ctx) {
      try {
        trackUsage(fromOpenAI(response), ctx, "trackOpenAI");
      } catch {}
    },

    trackAnthropic(response, ctx) {
      try {
        trackUsage(fromAnthropic(response), ctx, "trackAnthropic");
      } catch {}
    },

    trackGemini(response, ctx) {
      try {
        trackUsage(fromGemini(response), ctx, "trackGemini");
      } catch {}
    },

    trackStream(stream, ctx) {
      return (async function* () {
        const acc = new StreamUsage();
        try {
          for await (const chunk of stream) {
            try {
              acc.add(chunk);
            } catch {}
            yield chunk;
          }
        } finally {
          // Also runs when the caller stops early; partial usage is still
          // the best estimate of what was billed.
          try {
            finishStream(acc, ctx, "trackStream");
          } catch {}
        }
      })();
    },

    trackSSE(response, ctx) {
      try {
        if (!response.body) return response;
        const [mine, theirs] = response.body.tee();
        const acc = new StreamUsage();
        const done = readSSE(mine, (event) => acc.add(event))
          .then(() => finishStream(acc, ctx, "trackSSE"))
          .catch(() => {});
        reading.add(done);
        done.finally(() => reading.delete(done));
        keepAlive(done);
        return new Response(theirs, response);
      } catch {
        return response;
      }
    },

    track(event) {
      try {
        if (!options.apiKey) {
          warnOnce("no-key", "no apiKey given; events are not sent");
          return;
        }
        if (!event?.userId || !event.provider || !event.model) {
          warnOnce("invalid", "track() needs userId, provider and model; event skipped");
          return;
        }
        const ts = event.ts === undefined ? new Date() : new Date(event.ts);
        queue.push({
          id: crypto.randomUUID(),
          userId: String(event.userId),
          ts: (Number.isNaN(ts.getTime()) ? new Date() : ts).toISOString(),
          provider: event.provider,
          model: event.model,
          inputTokens: count(event.inputTokens),
          outputTokens: count(event.outputTokens),
          cachedTokens: count(event.cachedTokens),
          cacheWriteTokens: count(event.cacheWriteTokens),
          ...(typeof event.costUsd === "number" && event.costUsd >= 0 ? { costUsd: event.costUsd } : {}),
          ...(event.feature ? { feature: event.feature } : {}),
        });
        if (queue.length >= MAX_BATCH) void sendQueued();
        else schedule();
      } catch {
        // Metering must never break the caller.
      }
    },

    async flush() {
      try {
        await Promise.all([...reading]);
        await sendQueued();
        await Promise.all([...inflight]);
      } catch {}
    },
  };
  return meter;
}
