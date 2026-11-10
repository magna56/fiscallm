import { schema } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { gzipSync } from "node:zlib";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "../ingest/db";
import { freshApp, testDb } from "../test/app";
import { parseOtlpProto } from "./otlp";
import { otelRoute } from "./route";

let db: AnyDb;
let appId: string;
let key: string;
const api = () => new Hono().route("/v1/otel", otelRoute(() => db));

beforeAll(async () => {
  db = await testDb();
});
beforeEach(async () => {
  ({ appId, key } = await freshApp(db));
});

const TRACE = "5b8efff798038103d269b633813fc60c";
const nanos = (ms = Date.now()) => String(BigInt(ms) * 1_000_000n);
type Value = string | number | boolean;
const attr = (key: string, v: Value) => ({
  key,
  value: typeof v === "string" ? { stringValue: v } : typeof v === "boolean" ? { boolValue: v } : Number.isInteger(v) ? { intValue: String(v) } : { doubleValue: v },
});
const span = (spanId: string, name: string, attrs: Record<string, Value>, over: Record<string, unknown> = {}) => ({
  traceId: TRACE,
  spanId,
  name,
  startTimeUnixNano: nanos(Date.now() - 1000),
  endTimeUnixNano: nanos(),
  attributes: Object.entries(attrs).map(([k, v]) => attr(k, v)),
  ...over,
});
const body = (spans: unknown[], resource: Record<string, Value> = { "service.name": "app" }) => ({
  resourceSpans: [{ resource: { attributes: Object.entries(resource).map(([k, v]) => attr(k, v)) }, scopeSpans: [{ scope: { name: "ai" }, spans }] }],
});

function post(payload: unknown, headers: Record<string, string> = {}) {
  return api().request("/v1/otel/v1/traces", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}`, ...headers },
    body: JSON.stringify(payload),
  });
}
const events = () => db.select().from(schema.aiEvents).where(eq(schema.aiEvents.appId, appId));

const chat = { "gen_ai.operation.name": "chat", "gen_ai.provider.name": "openai", "gen_ai.request.model": "gpt-4o", "gen_ai.usage.input_tokens": 1_000_000, "gen_ai.usage.output_tokens": 100_000 };

describe("POST /v1/otel/v1/traces", () => {
  it("rejects a missing or wrong key", async () => {
    expect((await api().request("/v1/otel/v1/traces", { method: "POST", body: "{}" })).status).toBe(401);
    expect((await post(body([]), { authorization: "Bearer fsk_nope" })).status).toBe(401);
  });

  it("turns a GenAI chat span into a priced event", async () => {
    const res = await post(body([span("aaaaaaaaaaaaaaa1", "chat gpt-4o", { ...chat, "user.id": "user-1", "fiscallm.feature": "summary" })]));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
    const [e] = await events();
    expect(e).toMatchObject({ userId: "user-1", provider: "openai", model: "gpt-4o", inputTokens: 1_000_000, outputTokens: 100_000, feature: "summary", costSource: "table" });
    // gpt-4o: $2.50 in, $10 out per 1M tokens.
    expect(Number(e!.costUsd)).toBeCloseTo(3.5, 6);
  });

  it("does not count a resent span twice", async () => {
    const payload = body([span("aaaaaaaaaaaaaaa1", "chat gpt-4o", { ...chat, "user.id": "user-1" })]);
    await post(payload);
    await post(payload);
    expect(await events()).toHaveLength(1);
  });

  it("counts the provider call once when agent and step spans repeat its usage (AI SDK)", async () => {
    const res = await post(
      body([
        span("aaaaaaaaaaaaaaa1", "invoke_agent gpt-4o", { ...chat, "gen_ai.operation.name": "invoke_agent", "ai.settings.context.userId": "user-7", "gen_ai.agent.name": "support-chat" }),
        span("aaaaaaaaaaaaaaa2", "step 1", { "gen_ai.operation.name": "agent_step", "ai.settings.context.userId": "user-7" }, { parentSpanId: "aaaaaaaaaaaaaaa1" }),
        span("aaaaaaaaaaaaaaa3", "chat gpt-4o", chat, { parentSpanId: "aaaaaaaaaaaaaaa2" }),
        span("aaaaaaaaaaaaaaa4", "execute_tool search", { "gen_ai.operation.name": "execute_tool" }, { parentSpanId: "aaaaaaaaaaaaaaa2" }),
        span("aaaaaaaaaaaaaaa5", "GET /api/chat", { "http.request.method": "GET" }),
      ]),
    );
    expect(await res.json()).toEqual({});
    const stored = await events();
    expect(stored).toHaveLength(1);
    // The user and the feature come from the agent span above the call.
    expect(stored[0]).toMatchObject({ userId: "user-7", feature: "support-chat", inputTokens: 1_000_000 });
  });

  it("reads the older AI SDK span names and skips the outer span", async () => {
    await post(
      body([
        span("aaaaaaaaaaaaaaa1", "ai.generateText", { "ai.model.id": "gpt-4o", "ai.model.provider": "openai.chat", "ai.usage.promptTokens": 100, "ai.usage.completionTokens": 20, "ai.telemetry.metadata.userId": "user-2" }),
        span("aaaaaaaaaaaaaaa2", "ai.generateText.doGenerate", { "ai.model.id": "gpt-4o", "ai.model.provider": "openai.chat", "ai.usage.promptTokens": 100, "ai.usage.completionTokens": 20 }, { parentSpanId: "aaaaaaaaaaaaaaa1" }),
      ]),
    );
    const stored = await events();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ userId: "user-2", provider: "openai", model: "gpt-4o", inputTokens: 100, outputTokens: 20 });
  });

  it("takes cache reads and writes out of the input tokens", async () => {
    await post(
      body([
        span("aaaaaaaaaaaaaaa1", "chat claude-sonnet-4-5", {
          "gen_ai.operation.name": "chat",
          "gen_ai.provider.name": "anthropic",
          "gen_ai.response.model": "claude-sonnet-4-5-20250929",
          "gen_ai.usage.input_tokens": 1000,
          "gen_ai.usage.output_tokens": 50,
          "gen_ai.usage.cache_read.input_tokens": 600,
          "gen_ai.usage.cache_creation.input_tokens": 100,
          "user.id": "user-1",
        }),
      ]),
    );
    expect((await events())[0]).toMatchObject({ provider: "anthropic", inputTokens: 300, cachedTokens: 600, cacheWriteTokens: 100, outputTokens: 50 });
  });

  it("reads OpenInference and OpenLLMetry attributes, and the user from the resource", async () => {
    await post(
      body(
        [
          span("aaaaaaaaaaaaaaa1", "ChatCompletion", { "openinference.span.kind": "LLM", "llm.model_name": "gpt-4o", "llm.token_count.prompt": 10, "llm.token_count.completion": 5 }),
          span("aaaaaaaaaaaaaaa2", "openai.chat", { "gen_ai.system": "openai", "gen_ai.request.model": "gpt-4o", "gen_ai.usage.prompt_tokens": 7, "gen_ai.usage.completion_tokens": 3 }),
          span("aaaaaaaaaaaaaaa3", "agent", { "openinference.span.kind": "CHAIN", "llm.model_name": "gpt-4o", "llm.token_count.prompt": 99 }),
        ],
        { "user.id": "tenant-9" },
      ),
    );
    const stored = await events();
    expect(stored.map((e) => e.inputTokens ?? 0).sort((a, b) => a - b)).toEqual([7, 10]);
    expect(stored.every((e) => e.userId === "tenant-9")).toBe(true);
  });

  it("stores an exact cost when the span carries one", async () => {
    await post(body([span("aaaaaaaaaaaaaaa1", "chat custom", { "gen_ai.request.model": "my-finetune", "fiscallm.cost_usd": 0.42, "user.id": "user-1" })]));
    expect((await events())[0]).toMatchObject({ costSource: "client", model: "my-finetune" });
    expect(Number((await events())[0]!.costUsd)).toBeCloseTo(0.42, 8);
  });

  it("reports AI spans it could not attribute, and ignores other spans", async () => {
    const res = await post(body([span("aaaaaaaaaaaaaaa1", "chat gpt-4o", chat), span("aaaaaaaaaaaaaaa2", "db.query", { "db.system": "postgresql" })]));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { partialSuccess: { rejectedSpans: number; errorMessage: string } };
    expect(json.partialSuccess.rejectedSpans).toBe(1);
    expect(json.partialSuccess.errorMessage).toContain("user.id");
    expect(await events()).toHaveLength(0);
  });

  it("accepts gzip and rejects a body that is not OTLP", async () => {
    const gz = gzipSync(JSON.stringify(body([span("aaaaaaaaaaaaaaa1", "chat gpt-4o", { ...chat, "user.id": "user-1" })])));
    const res = await api().request("/v1/otel/v1/traces", {
      method: "POST",
      headers: { "content-type": "application/json", "content-encoding": "gzip", authorization: `Bearer ${key}` },
      body: gz,
    });
    expect(res.status).toBe(200);
    expect(await events()).toHaveLength(1);
    const bad = await api().request("/v1/otel/v1/traces", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: "not json" });
    expect(bad.status).toBe(400);
  });

  it("accepts metrics and logs without storing anything", async () => {
    expect((await api().request("/v1/otel/v1/metrics", { method: "POST", body: "{}" })).status).toBe(200);
    expect((await api().request("/v1/otel/v1/logs", { method: "POST", body: "{}" })).status).toBe(200);
  });
});

// A minimal protobuf writer, to check the reader against the wire format.
const varint = (n: bigint | number) => {
  const out: number[] = [];
  let v = BigInt(n);
  while (v > 0x7fn) {
    out.push(Number(v & 0x7fn) | 0x80);
    v >>= 7n;
  }
  out.push(Number(v));
  return out;
};
const len = (no: number, bytes: number[]) => [...varint((no << 3) | 2), ...varint(bytes.length), ...bytes];
const utf8 = (s: string) => [...new TextEncoder().encode(s)];
const fixed64 = (no: number, v: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, v, true);
  return [...varint((no << 3) | 1), ...b];
};
const unhex = (h: string) => h.match(/../g)!.map((x) => parseInt(x, 16));
const kv = (key: string, v: Value) => {
  const value = typeof v === "string" ? len(1, utf8(v)) : typeof v === "boolean" ? [0x10, v ? 1 : 0] : Number.isInteger(v) ? [0x18, ...varint(v)] : (() => {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, v, true);
    return [0x21, ...b];
  })();
  return [...len(1, utf8(key)), ...len(2, value)];
};
function protoBody(spans: { spanId: string; parent?: string; name: string; attrs: Record<string, Value> }[], resource: Record<string, Value> = {}) {
  const end = BigInt(Date.now()) * 1_000_000n;
  const encoded = spans.flatMap((s) =>
    len(2, [
      ...len(1, unhex(TRACE)),
      ...len(2, unhex(s.spanId)),
      ...(s.parent ? len(4, unhex(s.parent)) : []),
      ...len(5, utf8(s.name)),
      ...[0x30, 1], // kind (varint), skipped by the reader
      ...fixed64(7, end - 1_000_000_000n),
      ...fixed64(8, end),
      ...Object.entries(s.attrs).flatMap(([k, v]) => len(9, kv(k, v))),
    ]),
  );
  const res = len(1, Object.entries(resource).flatMap(([k, v]) => len(1, kv(k, v))));
  const scope = len(2, [...len(1, len(1, utf8("ai"))), ...encoded]);
  return new Uint8Array(len(1, [...res, ...scope]));
}

describe("protobuf", () => {
  it("reads spans, parents and typed attributes", () => {
    const spans = parseOtlpProto(protoBody([{ spanId: "aaaaaaaaaaaaaaa1", parent: "bbbbbbbbbbbbbbb2", name: "chat gpt-4o", attrs: { s: "x", i: 1_000_000, d: 0.5, b: true } }], { "service.name": "app" }));
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ traceId: TRACE, spanId: "aaaaaaaaaaaaaaa1", parentSpanId: "bbbbbbbbbbbbbbb2", name: "chat gpt-4o", attrs: { s: "x", i: 1_000_000, d: 0.5, b: true }, resource: { "service.name": "app" } });
    expect(Math.abs(spans[0]!.at.getTime() - Date.now())).toBeLessThan(5000);
  });

  it("stores events from a protobuf export and answers in protobuf", async () => {
    const send = (payload: Uint8Array) =>
      api().request("/v1/otel/v1/traces", { method: "POST", headers: { "content-type": "application/x-protobuf", authorization: `Bearer ${key}` }, body: payload });
    const ok = await send(protoBody([{ spanId: "aaaaaaaaaaaaaaa1", name: "chat gpt-4o", attrs: { ...chat, "user.id": "user-1" } }]));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/x-protobuf");
    expect((await ok.arrayBuffer()).byteLength).toBe(0);
    const [e] = await events();
    expect(e).toMatchObject({ userId: "user-1", inputTokens: 1_000_000, outputTokens: 100_000 });

    const partial = await send(protoBody([{ spanId: "aaaaaaaaaaaaaaa9", name: "chat gpt-4o", attrs: chat }]));
    const bytes = new Uint8Array(await partial.arrayBuffer());
    // partial_success { rejected_spans: 1, error_message }
    expect([...bytes.slice(0, 1)]).toEqual([0x0a]);
    expect(new TextDecoder().decode(bytes)).toContain("user.id");

    expect((await send(new Uint8Array([0x0a, 0xff]))).status).toBe(400);
  });
});
