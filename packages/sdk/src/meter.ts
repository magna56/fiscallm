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
  /**
   * Non-token usage, priced per unit by FiscaLLM: images, seconds of video,
   * minutes of audio, characters of speech. Use with `unit`.
   */
  units?: number;
  unit?: "image" | "second" | "minute" | "character";
  /** Picks a price variant, e.g. a resolution: "1080p", "4k", "2k". */
  variant?: string;
  /** Exact cost in USD; wins over FiscaLLM's prices. */
  costUsd?: number;
  /** Your own label, e.g. "chat" or "summary", to break cost down by. */
  feature?: string;
  /**
   * Your id for the job this call belongs to, e.g. a video render. Report
   * what happened to the user's payment with `trackJob`, and FiscaLLM shows
   * the cost of jobs the user was refunded for, or never charged.
   */
  jobId?: string;
  /** When the call happened. Defaults to now. */
  ts?: Date | string;
}

/**
 * What happened to the user's payment (or credits) for a job. Send it each
 * time the status changes; the newest report wins, and "pending" never
 * reopens a job already captured or refunded.
 */
export interface JobOutcome {
  /** The same `jobId` passed when tracking the job's AI calls. */
  jobId: string;
  userId: string;
  /**
   * pending: payment held, outcome not known yet (e.g. the provider timed out).
   * captured: the user was charged. refunded: the user got it back.
   */
  status: "pending" | "captured" | "refunded";
  /** When the status changed. Defaults to now. */
  ts?: Date | string;
}

/**
 * A payment from your own billing system (Stripe, App Store, Play), for
 * apps without RevenueCat. Retries with the same `id` are ignored.
 */
export interface RevenueEvent {
  /** Your unique id for this event, e.g. the payment or invoice id. */
  id: string;
  userId: string;
  type: "trial_started" | "purchase" | "renewal" | "refund" | "cancellation" | "expiration";
  productId?: string;
  /** Gross amount in USD; required for purchase, renewal and refund. */
  amountUsd?: number;
  /** What you keep after tax and fees; or give taxPct and feePct (0 to 1). */
  netUsd?: number;
  taxPct?: number;
  feePct?: number;
  /** When the paid or trial period ends; omit for one-time purchases. */
  periodEnd?: Date | string;
  isTrialConversion?: boolean;
  oneTime?: boolean;
  environment?: "production" | "sandbox";
  /** When it happened. Defaults to now. */
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
  /**
   * Kill switch. When true the meter does nothing: nothing is queued or sent,
   * streams and responses pass through untouched. Defaults to true when the
   * environment variable FISCALLM_DISABLED is "1" or "true", so you can turn
   * reporting off without a deploy.
   */
  disabled?: boolean;
}

export interface TrackContext {
  userId: string;
  feature?: string;
  /** See `TrackEvent.jobId`. */
  jobId?: string;
  /** Name an OpenAI-compatible provider, e.g. "groq" or "openrouter". */
  provider?: string;
  /** Overrides the model read from the response. */
  model?: string;
}

/** The answer to `meter.check(userId)`. */
export interface CheckResult {
  /** False only when the user reached a budget you marked "Block" in Settings. */
  allow: boolean;
  /** Why the user is refused, e.g. "daily AI budget reached ($6.00 of $5.00)". */
  reason?: string;
  spentToday?: number;
  spent30d?: number;
}

export interface Meter {
  /**
   * May this user make another AI call? Call it before the AI call and, on
   * `allow: false`, refuse, or switch to a cheaper model. Fails open: on any
   * error, timeout or missing key it returns `{ allow: true }`, so FiscaLLM
   * being slow or down never takes your app down. Never rejects.
   */
  check(userId: string): Promise<CheckResult>;
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
  /** Reports a payment, for apps without RevenueCat. Sent right away, in the background. */
  trackRevenue(event: RevenueEvent): void;
  /** Reports a job's payment status. Sent right away, in the background. */
  trackJob(outcome: JobOutcome): void;
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
  units?: number;
  unit?: string;
  variant?: string;
  costUsd?: number;
  feature?: string;
  jobId?: string;
}

const DEFAULT_ENDPOINT = "https://fiscallm.com/api/v1/events";
export const MAX_BATCH = 100;
const TIMEOUT_MS = 2000;
const RETRY_DELAY_MS = 250;
// check() waits this long at most before letting the call through, and
// remembers an answer briefly so a busy backend does not ask on every request.
const CHECK_TIMEOUT_MS = 1500;
const CHECK_CACHE_MS = 5000;
const CHECK_CACHE_MAX = 2000;
// Batch window for events from one request when waitUntil is available.
const WAIT_UNTIL_DELAY_MS = 50;
// Batch window for long-running servers without waitUntil.
const INTERVAL_MS = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const count = (n: number | undefined) =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : 0;

const DISABLED_METER: Meter = {
  async check() {
    return { allow: true };
  },
  track() {},
  trackOpenAI() {},
  trackAnthropic() {},
  trackGemini() {},
  trackStream: (stream) => stream,
  trackSSE: (response) => response,
  trackRevenue() {},
  trackJob() {},
  async flush() {},
};

function isDisabled(options: MeterOptions): boolean {
  if (options.disabled !== undefined) return options.disabled;
  try {
    const value = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.FISCALLM_DISABLED;
    return value === "1" || value?.toLowerCase() === "true";
  } catch {
    return false;
  }
}

export function createMeter(options: MeterOptions): Meter {
  if (isDisabled(options)) return DISABLED_METER;
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

  const checkCache = new Map<string, { value: CheckResult; at: number }>();
  let queue: WireEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingRelease: (() => void) | undefined;
  const inflight = new Set<Promise<void>>();
  // trackSSE copies still being read; flush() waits for them too.
  const reading = new Set<Promise<void>>();

  async function post(batch: unknown[], url = endpoint, field = "events"): Promise<"ok" | "retry" | "drop"> {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({ [field]: batch }),
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

  async function send(batch: unknown[], url = endpoint, field = "events"): Promise<void> {
    if ((await post(batch, url, field)) !== "retry") return;
    await sleep(RETRY_DELAY_MS);
    if ((await post(batch, url, field)) === "retry") {
      warnOnce("unreachable", `could not reach ${url}; ${batch.length} events dropped`);
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
      jobId: ctx.jobId,
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

    trackRevenue(event) {
      try {
        if (!options.apiKey) {
          warnOnce("no-key", "no apiKey given; events are not sent");
          return;
        }
        if (!event?.id || !event.userId || !event.type) {
          warnOnce("invalid-revenue", "trackRevenue() needs id, userId and type; event skipped");
          return;
        }
        const iso = (d: Date | string | undefined) => (d === undefined ? undefined : new Date(d).toISOString());
        const wire = { ...event, userId: String(event.userId), ts: iso(event.ts) ?? new Date().toISOString(), periodEnd: iso(event.periodEnd) };
        const p = send([wire], endpoint.replace(/\/events$/, "/revenue")).catch(() => {});
        inflight.add(p);
        p.finally(() => inflight.delete(p));
        keepAlive(p);
      } catch {
        // Metering must never break the caller.
      }
    },

    trackJob(outcome) {
      try {
        if (!options.apiKey) {
          warnOnce("no-key", "no apiKey given; events are not sent");
          return;
        }
        if (!outcome?.jobId || !outcome.userId || !["pending", "captured", "refunded"].includes(outcome.status)) {
          warnOnce("invalid-job", "trackJob() needs jobId, userId and a status of pending, captured or refunded; skipped");
          return;
        }
        const ts = outcome.ts === undefined ? new Date() : new Date(outcome.ts);
        const wire = {
          jobId: String(outcome.jobId),
          userId: String(outcome.userId),
          status: outcome.status,
          ts: (Number.isNaN(ts.getTime()) ? new Date() : ts).toISOString(),
        };
        const p = send([wire], endpoint.replace(/\/events$/, "/jobs"), "jobs").catch(() => {});
        inflight.add(p);
        p.finally(() => inflight.delete(p));
        keepAlive(p);
      } catch {
        // Metering must never break the caller.
      }
    },

    async check(userId) {
      const open: CheckResult = { allow: true };
      try {
        if (!options.apiKey || !userId) return open;
        const id = String(userId);
        const hit = checkCache.get(id);
        if (hit && Date.now() - hit.at < CHECK_CACHE_MS) return hit.value;
        const res = await fetch(endpoint.replace(/\/events$/, "/check"), {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${options.apiKey}` },
          body: JSON.stringify({ userId: id }),
          signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) warnOnce(`check-${res.status}`, `check() was refused (${res.status}); check the ingest key. Allowing the call.`);
          return open;
        }
        const data = (await res.json()) as Partial<CheckResult>;
        const value: CheckResult = {
          allow: data.allow !== false,
          ...(typeof data.reason === "string" ? { reason: data.reason } : {}),
          ...(typeof data.spentToday === "number" ? { spentToday: data.spentToday } : {}),
          ...(typeof data.spent30d === "number" ? { spent30d: data.spent30d } : {}),
        };
        if (checkCache.size >= CHECK_CACHE_MAX) checkCache.clear();
        checkCache.set(id, { value, at: Date.now() });
        return value;
      } catch {
        return open;
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
          ...(typeof event.units === "number" && event.units > 0 && event.unit ? { units: event.units, unit: event.unit } : {}),
          ...(event.variant && event.units ? { variant: String(event.variant) } : {}),
          ...(typeof event.costUsd === "number" && event.costUsd >= 0 ? { costUsd: event.costUsd } : {}),
          ...(event.feature ? { feature: event.feature } : {}),
          ...(event.jobId ? { jobId: String(event.jobId) } : {}),
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
