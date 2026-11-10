import { schema } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "../ingest/db";
import { freshApp, testDb } from "../test/app";
import { litellmRoute } from "./route";

let db: AnyDb;
let appId: string;
let key: string;
const api = () => new Hono().route("/v1/litellm", litellmRoute(() => db));

beforeAll(async () => {
  db = await testDb();
});
beforeEach(async () => {
  ({ appId, key } = await freshApp(db));
});

// The fields of LiteLLM's StandardLoggingPayload that matter here.
const log = (over: Record<string, unknown> = {}) => ({
  id: `chatcmpl-${crypto.randomUUID()}`,
  status: "success",
  call_type: "acompletion",
  response_cost: 0.0123,
  prompt_tokens: 1000,
  completion_tokens: 200,
  total_tokens: 1200,
  startTime: Date.now() / 1000 - 2,
  endTime: Date.now() / 1000,
  model: "gpt-4o",
  model_group: "gpt-4o",
  custom_llm_provider: "openai",
  end_user: "user-1",
  request_tags: [],
  metadata: {},
  messages: [{ role: "user", content: "secret" }],
  response: { choices: [] },
  ...over,
});

const post = (body: string, auth = `Bearer ${key}`) =>
  api().request("/v1/litellm", { method: "POST", headers: { "content-type": "application/json", authorization: auth }, body });
const events = () => db.select().from(schema.aiEvents).where(eq(schema.aiEvents.appId, appId));

describe("POST /v1/litellm", () => {
  it("rejects a missing or wrong key", async () => {
    expect((await api().request("/v1/litellm", { method: "POST", body: "[]" })).status).toBe(401);
    expect((await post("[]", "Bearer fsk_nope")).status).toBe(401);
  });

  it("takes the key with or without Bearer, as LiteLLM's os.environ/ header sends it", async () => {
    expect((await post("[]", key)).status).toBe(200);
    expect((await post("[]", "fsk_nope")).status).toBe(401);
  });

  it("stores a batch with LiteLLM's own cost", async () => {
    const res = await post(JSON.stringify([log(), log({ end_user: "user-2", response_cost: 0.5 })]));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ accepted: 2, duplicates: 0 });
    const stored = await events();
    expect(stored).toHaveLength(2);
    const one = stored.find((e) => e.userId === "user-1")!;
    expect(one).toMatchObject({ provider: "openai", model: "gpt-4o", inputTokens: 1000, outputTokens: 200, costSource: "client" });
    expect(Number(one.costUsd)).toBeCloseTo(0.0123, 8);
  });

  it("does not count a resent log twice", async () => {
    const body = JSON.stringify([log()]);
    await post(body);
    expect(await (await post(body)).json()).toMatchObject({ accepted: 0, duplicates: 1 });
    expect(await events()).toHaveLength(1);
  });

  it("reads one object and newline-delimited objects", async () => {
    expect(await (await post(JSON.stringify(log()))).json()).toMatchObject({ accepted: 1 });
    expect(await (await post(`${JSON.stringify(log())}\n${JSON.stringify(log())}\n`)).json()).toMatchObject({ accepted: 2 });
  });

  it("skips failed requests and requests with no user", async () => {
    const res = await post(JSON.stringify([log({ status: "failure" }), log({ end_user: "" }), log()]));
    const json = (await res.json()) as { accepted: number; skipped: Record<string, number>; hint?: string };
    expect(json).toMatchObject({ accepted: 1, skipped: { failedRequests: 1, noUser: 1, badTime: 0 } });
    expect(json.hint).toContain("user");
  });

  it("finds the user and feature in key metadata and tags", async () => {
    await post(
      JSON.stringify([
        log({ end_user: "", metadata: { user_api_key_end_user_id: "cust-1" }, request_tags: ["env:prod", "feature:search"] }),
        log({ end_user: "ignored", metadata: { spend_logs_metadata: { fiscallm_user_id: "cust-2", feature: "chat", job_id: "job-9" } } }),
      ]),
    );
    const stored = await events();
    expect(stored.find((e) => e.userId === "cust-1")).toMatchObject({ feature: "search" });
    expect(stored.find((e) => e.userId === "cust-2")).toMatchObject({ feature: "chat", jobId: "job-9" });
  });

  it("names providers and models like the price table, and splits out cached tokens", async () => {
    await post(
      JSON.stringify([
        log({
          model: "anthropic/claude-sonnet-4-5-20250929",
          custom_llm_provider: undefined,
          prompt_tokens: 1000,
          metadata: { usage_object: { cache_read_input_tokens: 600, cache_creation_input_tokens: 100 } },
        }),
      ]),
    );
    expect((await events())[0]).toMatchObject({ provider: "anthropic", model: "claude-sonnet-4-5-20250929", inputTokens: 300, cachedTokens: 600, cacheWriteTokens: 100 });
  });

  it("prices from the table when LiteLLM sent no cost", async () => {
    await post(JSON.stringify([log({ response_cost: null, prompt_tokens: 1_000_000, completion_tokens: 100_000 })]));
    const [e] = await events();
    expect(e!.costSource).toBe("table");
    expect(Number(e!.costUsd)).toBeCloseTo(3.5, 6);
  });

  it("rejects a body that is not JSON", async () => {
    expect((await post("nope")).status).toBe(400);
  });
});
