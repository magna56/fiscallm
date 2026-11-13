import { schema } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { gzipSync } from "node:zlib";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "../ingest/db";
import { freshApp, testDb } from "../test/app";
import { parseOtlpLogsProto, parseOtlpProto } from "./otlp";
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

  it("accepts metrics without storing anything", async () => {
    expect((await api().request("/v1/otel/v1/metrics", { method: "POST", body: "{}" })).status).toBe(200);
  });
});

// The attributes of a "claude_code.api_request" event, as Claude Code 2.1 exports
// them with OTEL_LOGS_EXPORTER=otlp (shape taken from a real export).
const apiRequest = (over: Record<string, Value> = {}) => ({
  "user.id": "f3a9installid",
  "session.id": "sess-1",
  "organization.id": "org-1",
  "user.email": "dev@example.com",
  "user.account_uuid": "7c1e6f0a-0000-4000-8000-000000000001",
  "user.account_id": "user_01Test",
  "terminal.type": "Apple_Terminal",
  "event.name": "api_request",
  "event.timestamp": new Date().toISOString(),
  "event.sequence": 4,
  model: "claude-sonnet-4-5-20250929",
  input_tokens: 1200,
  output_tokens: 350,
  cache_read_tokens: 40000,
  cache_creation_tokens: 2000,
  cache_creation_5m_tokens: 0,
  cache_creation_1h_tokens: 2000,
  cost_usd: 0.04210015,
  cost_usd_micros: 42100,
  duration_ms: 843,
  request_id: "req_011CTest",
  client_request_id: "aa38cce9-110a-49a4-97d0-8809c394e853",
  speed: "normal",
  ...over,
});
const logRecord = (attrs: Record<string, Value>, over: Record<string, unknown> = {}) => ({
  timeUnixNano: nanos(),
  observedTimeUnixNano: nanos(),
  body: { stringValue: "claude_code.api_request" },
  attributes: Object.entries(attrs).map(([k, v]) => attr(k, v)),
  ...over,
});
const logsBody = (records: unknown[], resource: Record<string, Value> = { "service.name": "claude-code" }) => ({
  resourceLogs: [{ resource: { attributes: Object.entries(resource).map(([k, v]) => attr(k, v)) }, scopeLogs: [{ scope: { name: "com.anthropic.claude_code.events" }, logRecords: records }] }],
});
const postLogs = (payload: unknown, headers: Record<string, string> = {}) =>
  api().request("/v1/otel/v1/logs", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}`, ...headers },
    body: JSON.stringify(payload),
  });

describe("POST /v1/otel/v1/logs (Claude Code)", () => {
  it("rejects a missing or wrong key", async () => {
    expect((await api().request("/v1/otel/v1/logs", { method: "POST", body: "{}" })).status).toBe(401);
    expect((await postLogs(logsBody([]), { authorization: "Bearer fsk_nope" })).status).toBe(401);
  });

  it("stores a model call under the developer's email with Claude Code's own cost", async () => {
    const res = await postLogs(logsBody([logRecord(apiRequest())]));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
    const [e] = await events();
    expect(e).toMatchObject({
      userId: "dev@example.com",
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250929",
      inputTokens: 1200,
      outputTokens: 350,
      cachedTokens: 40000,
      cacheWriteTokens: 2000,
      feature: "claude-code",
    });
    expect(Number(e!.costUsd)).toBeCloseTo(0.04210015, 8);
    expect(e!.costSource).toBe("client");
  });

  it("reads numbers sent as JSON numbers or as strings", async () => {
    const asNumbers = logRecord(apiRequest({ request_id: "req_n" }));
    for (const a of asNumbers.attributes) if ("intValue" in a.value) (a.value as { intValue: unknown }).intValue = Number(a.value.intValue);
    const asStrings = logRecord(apiRequest({ request_id: "req_s", input_tokens: "1200", output_tokens: "350", cache_read_tokens: "40000", cache_creation_tokens: "2000", cost_usd: "0.0421", cost_usd_micros: "42100" }));
    await postLogs(logsBody([asNumbers, asStrings]));
    const stored = await events();
    expect(stored).toHaveLength(2);
    for (const e of stored) expect(e).toMatchObject({ inputTokens: 1200, outputTokens: 350, cachedTokens: 40000, cacheWriteTokens: 2000 });
  });

  it("does not count a resent event twice, with or without a request ID", async () => {
    const noId = apiRequest({ model: "claude-haiku-4-5" });
    delete (noId as Record<string, unknown>).request_id;
    for (let i = 0; i < 2; i++) await postLogs(logsBody([logRecord(apiRequest()), logRecord(noId)]));
    expect(await events()).toHaveLength(2);
  });

  it("falls back to the account, then the install ID, and lets the resource name the user and team", async () => {
    const anon = apiRequest({ request_id: "req_a" });
    delete (anon as Record<string, unknown>)["user.email"];
    const install = apiRequest({ request_id: "req_b" });
    for (const k of ["user.email", "user.account_uuid", "user.account_id"]) delete (install as Record<string, unknown>)[k];
    await postLogs(logsBody([logRecord(anon), logRecord(install)]));
    await postLogs(logsBody([logRecord(apiRequest({ request_id: "req_c" }))], { "fiscallm.user_id": "alice", "team.id": "platform" }));
    const users = (await events()).map((e) => [e.userId, e.feature]).sort();
    expect(users).toEqual([
      ["7c1e6f0a-0000-4000-8000-000000000001", "claude-code"],
      ["alice", "platform"],
      ["f3a9installid", "claude-code"],
    ]);
  });

  it("leaves pricing to the table when no cost is sent, and uses micros when that is all there is", async () => {
    const noCost = apiRequest({ request_id: "req_d", model: "claude-sonnet-4-5" });
    for (const k of ["cost_usd", "cost_usd_micros"]) delete (noCost as Record<string, unknown>)[k];
    const micros = apiRequest({ request_id: "req_e", cost_usd_micros: 1500 });
    delete (micros as Record<string, unknown>).cost_usd;
    await postLogs(logsBody([logRecord(noCost), logRecord(micros)]));
    const byCost = (await events()).map((e) => [e.costSource, e.costUsd === null ? null : Number(e.costUsd)]).sort();
    // The test database only has the gpt-4o price row, so the table has no price here.
    expect(byCost).toEqual([
      ["client", 0.0015],
      ["table", null],
    ]);
  });

  it("ignores other events and reports model calls it could not store", async () => {
    const nobody = apiRequest({ request_id: "req_f" });
    for (const k of ["user.email", "user.account_uuid", "user.account_id", "user.id"]) delete (nobody as Record<string, unknown>)[k];
    const res = await postLogs(
      logsBody([
        logRecord({ "event.name": "user_prompt", prompt_length: "40", "user.email": "dev@example.com" }, { body: { stringValue: "claude_code.user_prompt" } }),
        logRecord({ "event.name": "tool_result", tool_name: "Bash", "user.email": "dev@example.com" }, { body: { stringValue: "claude_code.tool_result" } }),
        logRecord(nobody),
      ]),
    );
    expect(await res.json()).toMatchObject({ partialSuccess: { rejectedLogRecords: 1 } });
    expect(await events()).toHaveLength(0);
    const bad = await api().request("/v1/otel/v1/logs", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: "not json" });
    expect(bad.status).toBe(400);
  });
});

// Codex CLI: one "codex.sse_event" record per stream event; the completed
// one carries the token counts (codex-rs/otel session_telemetry.rs).
const codexCompleted = (over: Record<string, Value> = {}) => ({
  "event.name": "codex.sse_event",
  "event.timestamp": new Date().toISOString(),
  "event.kind": "response.completed",
  "conversation.id": "0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b",
  "app.version": "0.58.0",
  auth_mode: "Chatgpt",
  "user.account_id": "acct_123",
  "user.email": "dev@example.com",
  model: "gpt-4o",
  slug: "gpt-4o",
  input_token_count: 1_000_000,
  output_token_count: 100_000,
  cached_token_count: 200_000,
  reasoning_token_count: 20_000,
  tool_token_count: 1_100_000,
  ...over,
});

// A record as the agents send it: the body is a message, not the event name.
const agentRecord = (attrs: Record<string, Value>) => logRecord(attrs, { body: { stringValue: "event" } });

describe("POST /v1/otel/v1/logs (Codex CLI)", () => {
  it("prices a completed response from the table, without the cached tokens counted twice", async () => {
    const res = await postLogs(logsBody([agentRecord(codexCompleted())], { "service.name": "codex_cli_rs" }));
    expect(await res.json()).toEqual({});
    const [e] = await events();
    expect(e).toMatchObject({
      source: "codex",
      userId: "dev@example.com",
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 800_000,
      outputTokens: 100_000,
      cachedTokens: 200_000,
      cacheWriteTokens: 0,
      feature: "codex",
      costSource: "table",
    });
    // 0.8M × $2.50 + 0.2M × $1.25 + 0.1M × $10 per million.
    expect(Number(e!.costUsd)).toBeCloseTo(3.25, 6);
  });

  it("skips other stream events and failed responses, and does not count a resent event twice", async () => {
    const delta = codexCompleted({ "event.kind": "response.output_text.delta" });
    for (const k of ["input_token_count", "output_token_count"]) delete (delta as Record<string, unknown>)[k];
    const failed = codexCompleted({ "error.message": "stream disconnected" });
    for (const k of ["input_token_count", "output_token_count", "cached_token_count"]) delete (failed as Record<string, unknown>)[k];
    const sent = codexCompleted();
    for (let i = 0; i < 2; i++) await postLogs(logsBody([agentRecord(sent), agentRecord(delta), agentRecord(failed)]));
    expect((await events()).map((e) => e.source)).toEqual(["codex"]);
  });

  it("names the machine when Codex runs with an API key and no account", async () => {
    const apiKey = codexCompleted({ auth_mode: "ApiKey" });
    for (const k of ["user.email", "user.account_id"]) delete (apiKey as Record<string, unknown>)[k];
    await postLogs(logsBody([agentRecord(apiKey)], { "service.name": "codex_cli_rs", "host.name": "alice-mbp" }));
    expect((await events()).map((e) => e.userId)).toEqual(["alice-mbp"]);
  });
});

// Gemini CLI: one "gemini_cli.api_response" record per model call, plus a
// GenAI "operation details" record for the same call, which is not counted.
const geminiResponse = (over: Record<string, Value> = {}) => ({
  "event.name": "gemini_cli.api_response",
  "event.timestamp": new Date().toISOString(),
  "session.id": "8f1c2d3e-session",
  "installation.id": "inst-42",
  "user.email": "dev@example.com",
  model: "gemini-2.5-pro",
  status_code: 200,
  duration_ms: 1500,
  input_token_count: 5000,
  output_token_count: 700,
  cached_content_token_count: 3000,
  thoughts_token_count: 300,
  tool_token_count: 100,
  total_token_count: 6100,
  prompt_id: "8f1c2d3e-session########0",
  auth_type: "oauth-personal",
  ...over,
});

describe("POST /v1/otel/v1/logs (Gemini CLI)", () => {
  it("stores a model call with thinking billed as output and the duplicate GenAI record ignored", async () => {
    const details = logRecord(
      { "event.name": "gen_ai.client.inference.operation.details", "gen_ai.response.model": "gemini-2.5-pro", "gen_ai.usage.input_tokens": 5000, "gen_ai.usage.output_tokens": 700, "user.email": "dev@example.com" },
      { body: { stringValue: "GenAI operation details from gemini-2.5-pro." } },
    );
    const res = await postLogs(logsBody([logRecord(geminiResponse(), { body: { stringValue: "API response from gemini-2.5-pro. Status: 200. Duration: 1500ms." } }), details], { "service.name": "gemini-cli" }));
    expect(await res.json()).toEqual({});
    const stored = await events();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      source: "gemini-cli",
      userId: "dev@example.com",
      provider: "google",
      model: "gemini-2.5-pro",
      inputTokens: 2100,
      outputTokens: 1000,
      cachedTokens: 3000,
      feature: "gemini-cli",
    });
  });

  it("falls back to the install ID and keeps two calls of one prompt apart", async () => {
    const first = geminiResponse({ "event.timestamp": new Date(Date.now() - 2000).toISOString() });
    const second = geminiResponse({ output_token_count: 50 });
    for (const r of [first, second]) delete (r as Record<string, unknown>)["user.email"];
    for (let i = 0; i < 2; i++) await postLogs(logsBody([agentRecord(first), agentRecord(second)]));
    expect((await events()).map((e) => e.userId)).toEqual(["inst-42", "inst-42"]);
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

function protoLogsBody(records: { attrs: Record<string, Value>; body?: string; name?: string }[], resource: Record<string, Value> = {}) {
  const now = BigInt(Date.now()) * 1_000_000n;
  const encoded = records.flatMap((r) =>
    len(2, [
      ...fixed64(1, now),
      ...[0x10, 9], // severity_number (varint), skipped by the reader
      ...(r.body ? len(5, len(1, utf8(r.body))) : []),
      ...Object.entries(r.attrs).flatMap(([k, v]) => len(6, kv(k, v))),
      ...fixed64(11, now),
      ...(r.name ? len(12, utf8(r.name)) : []),
    ]),
  );
  const res = len(1, Object.entries(resource).flatMap(([k, v]) => len(1, kv(k, v))));
  const scope = len(2, [...len(1, len(1, utf8("events"))), ...encoded]);
  return new Uint8Array(len(1, [...res, ...scope]));
}

describe("protobuf logs", () => {
  it("reads log records, their body, event name and attributes", () => {
    const logs = parseOtlpLogsProto(protoLogsBody([{ attrs: { model: "claude-haiku-4-5", input_tokens: 12 }, body: "claude_code.api_request", name: "api_request" }], { "team.id": "web" }));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ body: "claude_code.api_request", name: "api_request", attrs: { model: "claude-haiku-4-5", input_tokens: 12 }, resource: { "team.id": "web" } });
    expect(Math.abs(logs[0]!.at!.getTime() - Date.now())).toBeLessThan(5000);
  });

  it("stores model calls from a protobuf export, by event name alone", async () => {
    const attrs = apiRequest();
    delete (attrs as Record<string, unknown>)["event.name"];
    const res = await api().request("/v1/otel/v1/logs", {
      method: "POST",
      headers: { "content-type": "application/x-protobuf", authorization: `Bearer ${key}` },
      body: protoLogsBody([{ attrs, name: "claude_code.api_request" }]),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-protobuf");
    const [e] = await events();
    expect(e).toMatchObject({ userId: "dev@example.com", inputTokens: 1200, cachedTokens: 40000 });
  });
});

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
