import { normalizeModel, stableUuid, tsInRange } from "../ingest/pipeline";
import type { IngestEvent } from "../ingest/validate";
import type { Attrs, AttrValue, OtelSpan } from "./otlp";

// Turns OpenTelemetry spans into FiscaLLM events. It reads the attribute
// names of the OpenTelemetry GenAI conventions (gen_ai.*), the Vercel AI SDK
// (ai.*), OpenLLMetry (llm.usage.*) and OpenInference (llm.token_count.*).
// Prompts and responses on a span are never read or stored.

const USER_KEYS = [
  "fiscallm.user_id",
  "user.id",
  "enduser.id",
  "app.user.id",
  "ai.telemetry.metadata.userId",
  "ai.telemetry.metadata.user_id",
  // AI SDK 7 with `runtimeContext: true`; older releases used the longer name.
  "ai.settings.context.userId",
  "ai.settings.context.user_id",
  "ai.settings.runtimeContext.userId",
  "ai.settings.runtimeContext.user_id",
  "langfuse.user.id",
  "traceloop.association.properties.user_id",
  "langsmith.metadata.user_id",
  "session.user.id",
  "user_id",
  "userId",
];
const FEATURE_KEYS = [
  "fiscallm.feature",
  "ai.telemetry.metadata.feature",
  "ai.telemetry.functionId",
  "gen_ai.agent.name",
  "traceloop.workflow.name",
];
const MODEL_KEYS = ["gen_ai.response.model", "ai.response.model", "gen_ai.request.model", "ai.model.id", "llm.model_name"];
const PROVIDER_KEYS = ["gen_ai.provider.name", "gen_ai.system", "ai.model.provider", "llm.provider", "llm.system"];

const INPUT = ["gen_ai.usage.input_tokens", "gen_ai.usage.prompt_tokens", "ai.usage.inputTokens", "ai.usage.promptTokens", "llm.token_count.prompt", "llm.usage.prompt_tokens", "ai.usage.tokens"];
const OUTPUT = ["gen_ai.usage.output_tokens", "gen_ai.usage.completion_tokens", "ai.usage.outputTokens", "ai.usage.completionTokens", "llm.token_count.completion", "llm.usage.completion_tokens"];
const CACHE_READ = ["gen_ai.usage.cache_read.input_tokens", "gen_ai.usage.cache_read_input_tokens", "ai.usage.cachedInputTokens", "llm.token_count.prompt_details.cache_read", "llm.usage.cache_read_input_tokens"];
const CACHE_WRITE = ["gen_ai.usage.cache_creation.input_tokens", "gen_ai.usage.cache_creation_input_tokens", "llm.token_count.prompt_details.cache_write", "llm.usage.cache_creation_input_tokens"];

// One provider request. Spans around it (an agent run, a step, a tool call)
// repeat its token counts and must not be counted again.
const CALL_OPS = new Set(["chat", "text_completion", "generate_content", "embeddings", "embedding", "completion"]);
const KNOWN_OPS = new Set([...CALL_OPS, "invoke_agent", "create_agent", "execute_tool", "agent_step", "step", "rerank", "decide"]);
const AI_SDK_OUTER = /^ai\.(generateText|streamText|generateObject|streamObject|embed|embedMany)$/;

const text = (v: AttrValue | undefined) => (v === undefined || v === "" ? undefined : String(v));

function pick(attrs: Attrs, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = text(attrs[k]);
    if (v !== undefined) return v;
  }
  return undefined;
}

function count(attrs: Attrs, keys: string[]): number {
  for (const k of keys) {
    const n = Number(attrs[k]);
    if (attrs[k] !== undefined && typeof attrs[k] !== "boolean" && Number.isFinite(n) && n >= 0) return Math.min(Math.round(n), 1e9);
  }
  return 0;
}

function operation(s: OtelSpan): string | undefined {
  const named = text(s.attrs["gen_ai.operation.name"])?.toLowerCase();
  if (named) return named;
  const first = s.name.split(" ")[0]!.toLowerCase();
  return KNOWN_OPS.has(first) ? first : undefined;
}

function isCall(s: OtelSpan): boolean {
  if (!pick(s.attrs, MODEL_KEYS)) return false;
  const hasUsage = count(s.attrs, INPUT) + count(s.attrs, OUTPUT) + count(s.attrs, CACHE_READ) + count(s.attrs, CACHE_WRITE) > 0;
  if (!hasUsage && s.attrs["fiscallm.cost_usd"] === undefined) return false;
  const op = operation(s);
  if (op && !CALL_OPS.has(op)) return false;
  if (AI_SDK_OUTER.test(s.name) || AI_SDK_OUTER.test(text(s.attrs["ai.operationId"]) ?? "")) return false;
  const kind = text(s.attrs["openinference.span.kind"])?.toUpperCase();
  if (kind && kind !== "LLM" && kind !== "EMBEDDING") return false;
  return true;
}

export interface Mapped {
  events: IngestEvent[];
  /** Spans that are AI calls, whether or not they could be stored. */
  calls: number;
  noUser: number;
  badTime: number;
}

export async function spansToEvents(spans: OtelSpan[]): Promise<Mapped> {
  const id = (traceId: string, spanId: string) => `${traceId}:${spanId}`;
  const byId = new Map(spans.map((s) => [id(s.traceId, s.spanId), s]));
  const byTrace = new Map<string, OtelSpan[]>();
  for (const s of spans) byTrace.set(s.traceId, [...(byTrace.get(s.traceId) ?? []), s]);
  const parent = (s: OtelSpan) => (s.parentSpanId ? byId.get(id(s.traceId, s.parentSpanId)) : undefined);

  // A span that has an AI call below it is a wrapper, whatever it is named.
  const candidates = new Set(spans.filter(isCall));
  const wrappers = new Set<OtelSpan>();
  for (const s of candidates) {
    let up = parent(s);
    for (let depth = 0; up && depth < 50; depth++, up = parent(up)) {
      if (candidates.has(up)) wrappers.add(up);
    }
  }

  // The nearest value on the span or a span above it.
  const inherited = (s: OtelSpan, keys: string[]) => {
    let at: OtelSpan | undefined = s;
    for (let depth = 0; at && depth < 50; depth++, at = parent(at)) {
      const v = pick(at.attrs, keys);
      if (v) return v;
    }
    return undefined;
  };

  // The user is often set on the request's root span, not on the AI call.
  const userOf = (s: OtelSpan) => {
    const above = inherited(s, USER_KEYS);
    if (above) return above;
    for (const other of byTrace.get(s.traceId) ?? []) {
      const u = pick(other.attrs, USER_KEYS);
      if (u) return u;
    }
    return pick(s.resource, USER_KEYS);
  };

  const out: Mapped = { events: [], calls: 0, noUser: 0, badTime: 0 };
  for (const s of candidates) {
    if (wrappers.has(s)) continue;
    out.calls++;
    const userId = userOf(s);
    if (!userId || userId.length > 256) {
      out.noUser++;
      continue;
    }
    if (!tsInRange(s.at)) {
      out.badTime++;
      continue;
    }

    const { provider, model } = normalizeModel(pick(s.attrs, PROVIDER_KEYS), pick(s.attrs, MODEL_KEYS)!);
    const total = count(s.attrs, INPUT);
    const cachedTokens = count(s.attrs, CACHE_READ);
    const cacheWriteTokens = count(s.attrs, CACHE_WRITE);
    // The conventions say input tokens include cached ones. Some
    // instrumentations report them apart; then the cached count is larger
    // than the input count and nothing is subtracted.
    const cache = cachedTokens + cacheWriteTokens;
    const inputTokens = cache <= total ? total - cache : total;
    const exact = Number(s.attrs["fiscallm.cost_usd"]);

    out.events.push({
      id: await stableUuid(`otel:${s.traceId}:${s.spanId}`),
      userId,
      ts: s.at,
      provider: provider.slice(0, 64),
      model: model.slice(0, 128),
      inputTokens,
      outputTokens: count(s.attrs, OUTPUT),
      cachedTokens,
      cacheWriteTokens,
      ...(s.attrs["fiscallm.cost_usd"] !== undefined && Number.isFinite(exact) && exact >= 0 && exact <= 1000 ? { costUsd: exact } : {}),
      feature: inherited(s, FEATURE_KEYS)?.slice(0, 64),
      jobId: inherited(s, ["fiscallm.job_id"])?.slice(0, 128),
    });
  }
  return out;
}
