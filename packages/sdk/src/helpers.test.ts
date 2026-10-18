import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMeter } from "./meter.js";

const ctx = { userId: "u1", feature: "chat" };
const quiet = { warn: vi.fn() };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 202 }));
  vi.stubGlobal("fetch", fetchMock);
  quiet.warn.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

async function sent(run: (m: ReturnType<typeof createMeter>) => void | Promise<void>) {
  const meter = createMeter({ apiKey: "k", logger: quiet });
  await run(meter);
  await meter.flush();
  return fetchMock.mock.calls.flatMap((c) => JSON.parse((c[1] as RequestInit).body as string).events);
}

async function* from<T>(items: T[]) {
  for (const i of items) yield i;
}

const sse = (events: unknown[], split = 7) => {
  const text = events.map((e) => `event: x\ndata: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n";
  const bytes = new TextEncoder().encode(text);
  // Deliver in small pieces so lines and multi-byte characters are split.
  return new Response(
    new ReadableStream({
      start(c) {
        for (let i = 0; i < bytes.length; i += split) c.enqueue(bytes.slice(i, i + split));
        c.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
};

describe("trackOpenAI", () => {
  it("reads Chat Completions usage and takes cached tokens out of the input", async () => {
    const [e] = await sent((m) =>
      m.trackOpenAI(
        {
          object: "chat.completion",
          model: "gpt-4o-2024-08-06",
          usage: {
            prompt_tokens: 1000,
            completion_tokens: 200,
            total_tokens: 1200,
            prompt_tokens_details: { cached_tokens: 300, cache_write_tokens: 100 },
            completion_tokens_details: { reasoning_tokens: 50 },
          },
        },
        ctx,
      ),
    );
    expect(e).toMatchObject({
      userId: "u1",
      feature: "chat",
      provider: "openai",
      model: "gpt-4o-2024-08-06",
      inputTokens: 600,
      cachedTokens: 300,
      cacheWriteTokens: 100,
      outputTokens: 200,
    });
  });

  it("reads Responses API usage", async () => {
    const [e] = await sent((m) =>
      m.trackOpenAI(
        {
          object: "response",
          model: "gpt-5.4",
          usage: {
            input_tokens: 500,
            input_tokens_details: { cached_tokens: 100, cache_write_tokens: 0 },
            output_tokens: 80,
            output_tokens_details: { reasoning_tokens: 30 },
            total_tokens: 580,
          },
        },
        ctx,
      ),
    );
    expect(e).toMatchObject({ model: "gpt-5.4", inputTokens: 400, cachedTokens: 100, outputTokens: 80 });
  });

  it("takes a provider name for OpenAI-compatible APIs", async () => {
    const [e] = await sent((m) =>
      m.trackOpenAI({ model: "llama-4", usage: { prompt_tokens: 10, completion_tokens: 2 } }, { ...ctx, provider: "groq" }),
    );
    expect(e).toMatchObject({ provider: "groq", model: "llama-4", inputTokens: 10 });
  });

  it("warns once and skips a response without usage", async () => {
    const events = await sent((m) => {
      m.trackOpenAI({ model: "x" }, ctx);
      m.trackOpenAI(null, ctx);
    });
    expect(events).toHaveLength(0);
    expect(quiet.warn).toHaveBeenCalledTimes(1);
  });
});

describe("trackAnthropic", () => {
  it("maps cache reads and writes", async () => {
    const [e] = await sent((m) =>
      m.trackAnthropic(
        {
          type: "message",
          model: "claude-opus-5-5",
          usage: { input_tokens: 50, cache_creation_input_tokens: 2000, cache_read_input_tokens: 8000, output_tokens: 400 },
        },
        ctx,
      ),
    );
    expect(e).toMatchObject({
      provider: "anthropic",
      model: "claude-opus-5-5",
      inputTokens: 50,
      cacheWriteTokens: 2000,
      cachedTokens: 8000,
      outputTokens: 400,
    });
  });
});

describe("trackGemini", () => {
  it("counts thinking as output and takes cached tokens out of the prompt", async () => {
    const [e] = await sent((m) =>
      m.trackGemini(
        {
          modelVersion: "gemini-2.5-flash",
          usageMetadata: {
            promptTokenCount: 1000,
            cachedContentTokenCount: 600,
            toolUsePromptTokenCount: 50,
            candidatesTokenCount: 100,
            thoughtsTokenCount: 300,
            totalTokenCount: 1450,
          },
        },
        ctx,
      ),
    );
    expect(e).toMatchObject({
      provider: "google",
      model: "gemini-2.5-flash",
      inputTokens: 450,
      cachedTokens: 600,
      outputTokens: 400,
    });
  });
});

const anthropicStream = [
  { type: "message_start", message: { model: "claude-opus-5-5", usage: { input_tokens: 2679, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 3 } } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hé" } },
  { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { input_tokens: 10682, cache_read_input_tokens: 500, output_tokens: 510 } },
  { type: "message_stop" },
];

describe("trackStream", () => {
  it("passes chunks through and reads cumulative Anthropic usage", async () => {
    const seen: unknown[] = [];
    const [e] = await sent(async (m) => {
      for await (const c of m.trackStream(from(anthropicStream), ctx)) seen.push(c);
    });
    expect(seen).toEqual(anthropicStream);
    expect(e).toMatchObject({ model: "claude-opus-5-5", inputTokens: 10682, cachedTokens: 500, outputTokens: 510 });
  });

  it("reads the usage chunk of an OpenAI chat stream", async () => {
    const [e] = await sent(async (m) => {
      for await (const _ of m.trackStream(
        from([
          { object: "chat.completion.chunk", model: "gpt-4o-mini", choices: [{ delta: { content: "hi" } }] },
          { object: "chat.completion.chunk", model: "gpt-4o-mini", choices: [], usage: { prompt_tokens: 12, completion_tokens: 3 } },
        ]),
        ctx,
      ));
    });
    expect(e).toMatchObject({ model: "gpt-4o-mini", inputTokens: 12, outputTokens: 3 });
  });

  it("warns when an OpenAI stream has no usage", async () => {
    const events = await sent(async (m) => {
      for await (const _ of m.trackStream(from([{ object: "chat.completion.chunk", model: "m", choices: [] }]), ctx));
    });
    expect(events).toHaveLength(0);
    expect(quiet.warn.mock.calls[0]![0]).toContain("include_usage");
  });

  it("reads response.completed from a Responses API stream", async () => {
    const [e] = await sent(async (m) => {
      for await (const _ of m.trackStream(
        from([
          { type: "response.output_text.delta", delta: "hi" },
          { type: "response.completed", response: { model: "gpt-5.4", usage: { input_tokens: 40, output_tokens: 9 } } },
        ]),
        ctx,
      ));
    });
    expect(e).toMatchObject({ model: "gpt-5.4", inputTokens: 40, outputTokens: 9 });
  });

  it("uses the last Gemini chunk", async () => {
    const [e] = await sent(async (m) => {
      for await (const _ of m.trackStream(
        from([
          { candidates: [{}], modelVersion: "gemini-2.5-pro", usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 1 } },
          { candidates: [{}], modelVersion: "gemini-2.5-pro", usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 90 } },
        ]),
        ctx,
      ));
    });
    expect(e).toMatchObject({ model: "gemini-2.5-pro", inputTokens: 30, outputTokens: 90 });
  });

  it("still records usage when the caller stops early", async () => {
    const events = await sent(async (m) => {
      for await (const c of m.trackStream(from(anthropicStream), ctx)) {
        if ((c as { type: string }).type === "content_block_delta") break;
      }
    });
    expect(events[0]).toMatchObject({ inputTokens: 2679, outputTokens: 3 });
  });
});

describe("trackSSE", () => {
  it("parses a JSON event split across two chunks", async () => {
    const event = {
      object: "chat.completion.chunk",
      model: "gpt-4o-mini",
      choices: [],
      usage: { prompt_tokens: 8, completion_tokens: 2 },
    };
    const text = `data: ${JSON.stringify(event)}\n\n`;
    const bytes = new TextEncoder().encode(text);
    const split = text.indexOf('"usage"') + 3;
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(bytes.slice(0, split));
          controller.enqueue(bytes.slice(split));
          controller.close();
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    );

    let passed = "";
    const [recorded] = await sent(async (m) => {
      const tracked = m.trackSSE(response, ctx);
      passed = await tracked.text();
    });
    expect(passed).toBe(text);
    expect(recorded).toMatchObject({ model: "gpt-4o-mini", inputTokens: 8, outputTokens: 2 });
  });

  it("ignores SSE comments and the [DONE] sentinel", async () => {
    const event = {
      object: "chat.completion.chunk",
      model: "gpt-4o-mini",
      choices: [],
      usage: { prompt_tokens: 5, completion_tokens: 1 },
    };
    const text = `: keep-alive\n\ndata: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`;
    const [recorded] = await sent(async (m) => {
      await m.trackSSE(new Response(text), ctx).text();
    });
    expect(recorded).toMatchObject({ model: "gpt-4o-mini", inputTokens: 5, outputTokens: 1 });
  });

  it("warns and skips a stream that ends without a usage block", async () => {
    const text = `data: ${JSON.stringify({
      object: "chat.completion.chunk",
      model: "gpt-4o-mini",
      choices: [{ delta: { content: "hello" } }],
    })}\n\ndata: [DONE]\n\n`;
    const events = await sent(async (m) => {
      await m.trackSSE(new Response(text), ctx).text();
    });
    expect(events).toHaveLength(0);
    expect(quiet.warn.mock.calls[0]![0]).toContain("OpenAI stream had no usage");
  });

  it("returns the same bytes and tracks usage from a copy", async () => {
    const original = sse(anthropicStream);
    const expected = await original.clone().text();
    let passed = "";
    const [e] = await sent(async (m) => {
      const res = m.trackSSE(original, ctx);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/event-stream");
      passed = await res.text();
    });
    expect(passed).toBe(expected);
    expect(e).toMatchObject({ provider: "anthropic", inputTokens: 10682, outputTokens: 510 });
  });

  it("handles CRLF line endings", async () => {
    const text = `data: ${JSON.stringify({ object: "chat.completion.chunk", model: "m", choices: [], usage: { prompt_tokens: 5, completion_tokens: 1 } })}\r\n\r\n`;
    const [e] = await sent(async (m) => {
      await m.trackSSE(new Response(text), ctx).text();
    });
    expect(e).toMatchObject({ inputTokens: 5, outputTokens: 1 });
  });

  it("keeps the runtime alive until the copy is read", async () => {
    const kept: Promise<unknown>[] = [];
    const meter = createMeter({ apiKey: "k", logger: quiet, waitUntil: (p) => kept.push(p) });
    await meter.trackSSE(sse(anthropicStream), ctx).text();
    expect(kept.length).toBeGreaterThan(0);
    await Promise.all(kept);
    await meter.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
