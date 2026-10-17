// Reads token usage from provider responses by shape, without importing
// any provider SDK, so plain `fetch` + `res.json()` works the same way.
// Our convention: inputTokens excludes cache reads and cache writes.

export interface Usage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
}

// Provider payloads are untyped here on purpose.
type Obj = Record<string, any>;

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;

/** Chat Completions `usage` or Responses API `usage`. */
function openAIUsage(model: string, u: Obj): Usage {
  const total = n(u.prompt_tokens ?? u.input_tokens);
  const details = u.prompt_tokens_details ?? u.input_tokens_details ?? {};
  const cached = n(details.cached_tokens);
  const written = n(details.cache_write_tokens);
  return {
    provider: "openai",
    model,
    inputTokens: Math.max(0, total - cached - written),
    // Includes reasoning tokens, which are billed as output.
    outputTokens: n(u.completion_tokens ?? u.output_tokens),
    cachedTokens: cached,
    cacheWriteTokens: written,
  };
}

function anthropicUsage(model: string, u: Obj): Usage {
  return {
    provider: "anthropic",
    model,
    inputTokens: n(u.input_tokens),
    outputTokens: n(u.output_tokens),
    cachedTokens: n(u.cache_read_input_tokens),
    cacheWriteTokens: n(u.cache_creation_input_tokens),
  };
}

function geminiUsage(model: string, u: Obj): Usage {
  const cached = n(u.cachedContentTokenCount);
  return {
    provider: "google",
    model,
    // promptTokenCount includes the cached part.
    inputTokens: Math.max(0, n(u.promptTokenCount) - cached) + n(u.toolUsePromptTokenCount),
    // Thinking tokens are billed at the output price.
    outputTokens: n(u.candidatesTokenCount) + n(u.thoughtsTokenCount),
    cachedTokens: cached,
    cacheWriteTokens: 0,
  };
}

export function fromOpenAI(res: unknown): Usage | null {
  if (!isObj(res) || !isObj(res.usage)) return null;
  return openAIUsage(String(res.model ?? ""), res.usage);
}

export function fromAnthropic(res: unknown): Usage | null {
  if (!isObj(res) || !isObj(res.usage)) return null;
  return anthropicUsage(String(res.model ?? ""), res.usage);
}

export function fromGemini(res: unknown): Usage | null {
  if (!isObj(res) || !isObj(res.usageMetadata)) return null;
  return geminiUsage(String(res.modelVersion ?? ""), res.usageMetadata);
}

/**
 * Collects usage from streamed chunks or SSE events of any of the three
 * providers. Feed every chunk, then read `usage` at the end.
 */
export class StreamUsage {
  private kind: "openai" | "anthropic" | "google" | undefined;
  private model = "";
  private raw: Obj | undefined;

  /** True for an OpenAI stream that ended without a usage chunk. */
  get missingOpenAIUsage(): boolean {
    return this.kind === "openai" && this.raw === undefined;
  }

  add(chunk: unknown): void {
    if (!isObj(chunk)) return;
    const type = typeof chunk.type === "string" ? chunk.type : "";

    // Anthropic: message_start has the input; message_delta has cumulative
    // totals that can also update the input counts.
    if (type === "message_start" && isObj(chunk.message)) {
      this.kind = "anthropic";
      this.model = String(chunk.message.model ?? this.model);
      this.raw = { ...(chunk.message.usage ?? {}) };
      return;
    }
    if (type === "message_delta") {
      this.kind = "anthropic";
      if (isObj(chunk.usage)) {
        for (const [k, v] of Object.entries(chunk.usage)) if (v != null) (this.raw ??= {})[k] = v;
      }
      return;
    }

    // OpenAI Responses API: response.completed (or .incomplete / .failed).
    if (type.startsWith("response.") && isObj(chunk.response)) {
      this.kind = "openai";
      if (chunk.response.model) this.model = String(chunk.response.model);
      if (isObj(chunk.response.usage)) this.raw = chunk.response.usage;
      return;
    }

    // OpenAI Chat Completions: usage arrives on the last chunk, only with
    // stream_options.include_usage.
    if (chunk.object === "chat.completion.chunk" || Array.isArray(chunk.choices)) {
      this.kind = "openai";
      if (chunk.model) this.model = String(chunk.model);
      if (isObj(chunk.usage)) this.raw = chunk.usage;
      return;
    }

    // Gemini: every chunk may carry usageMetadata; the last one is final.
    if (isObj(chunk.usageMetadata) || "candidates" in chunk) {
      this.kind = "google";
      if (chunk.modelVersion) this.model = String(chunk.modelVersion);
      if (isObj(chunk.usageMetadata)) this.raw = chunk.usageMetadata;
    }
  }

  get usage(): Usage | null {
    if (!this.kind || !this.raw) return null;
    if (this.kind === "anthropic") return anthropicUsage(this.model, this.raw);
    if (this.kind === "google") return geminiUsage(this.model, this.raw);
    return openAIUsage(this.model, this.raw);
  }
}

/** Calls `onEvent` with each JSON `data:` payload of an SSE byte stream. */
export async function readSSE(body: ReadableStream<Uint8Array>, onEvent: (data: unknown) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const line = (l: string) => {
    if (!l.startsWith("data:")) return;
    const data = l.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      onEvent(JSON.parse(data));
    } catch {}
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buffer.search(/\r?\n/)) >= 0) {
      line(buffer.slice(0, i));
      buffer = buffer.slice(buffer[i] === "\r" ? i + 2 : i + 1);
    }
  }
  line(buffer + decoder.decode());
}
