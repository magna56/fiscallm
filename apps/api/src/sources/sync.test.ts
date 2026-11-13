import { schema, sealSecret } from "@fiscallm/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "../ingest/db";
import { ingestEvents, stableUuid } from "../ingest/pipeline";
import { freshApp, testDb } from "../test/app";
import { anthropic } from "./anthropic";
import { cursor } from "./cursor";
import { floorHour, HOUR } from "./http";
import { openai } from "./openai";
import { syncRoute, syncSource } from "./sync";
import type { PullSource } from "./types";

// The providers are faked with responses in the format their docs publish;
// none of these connectors has been run against a live account yet.

let db: AnyDb;
let appId: string;
const prevSecret = process.env.CRON_SECRET;

beforeAll(async () => {
  db = await testDb();
  process.env.CRON_SECRET = "test-secret";
});
afterAll(() => {
  process.env.CRON_SECRET = prevSecret;
});
beforeEach(async () => {
  ({ appId } = await freshApp(db));
});

async function connect(source: PullSource, key = "test-key") {
  await db.insert(schema.appSources).values({ appId, source: source.id, keyCipher: await sealSecret("test-secret", key) });
}
const row = async (source: string) =>
  (await db.select().from(schema.appSources).where(and(eq(schema.appSources.appId, appId), eq(schema.appSources.source, source))))[0]!;
const events = () => db.select().from(schema.aiEvents).where(eq(schema.aiEvents.appId, appId));

type Handler = (url: URL, init: RequestInit) => unknown;
/** A fetch that answers with JSON from the handler, or the status it returns as { status }. */
function fake(handler: Handler) {
  const calls: URL[] = [];
  const f = (async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push(url);
    const out = handler(url, init);
    if (out && typeof out === "object" && "status" in out) return new Response("{}", { status: (out as { status: number }).status });
    return Response.json(out);
  }) as typeof fetch;
  return Object.assign(f, { calls });
}
const header = (init: RequestInit, name: string) => new Headers(init.headers).get(name);

const now = new Date();
const hoursAgo = (h: number) => floorHour(now.getTime()) - h * HOUR;

describe("Cursor", () => {
  const usage = [
    { timestamp: String(hoursAgo(30) + 5000), userEmail: "dev@example.com", model: "claude-4.5-sonnet", kind: "Usage-based", isTokenBasedCall: true, chargedCents: 12, tokenUsage: { inputTokens: 1200, outputTokens: 300, cacheReadTokens: 9000, cacheWriteTokens: 0, totalCents: 10 } },
    { timestamp: String(hoursAgo(50)), userEmail: "lead@example.com", model: "gpt-5", kind: "Included in Business", isTokenBasedCall: true, chargedCents: 0, tokenUsage: { inputTokens: 500, outputTokens: 100, totalCents: 3.5 } },
  ];
  const api = fake((url, init) => {
    if (header(init, "authorization") !== `Basic ${btoa("test-key:")}`) return { status: 401 };
    if (url.pathname === "/teams/members") return { teamMembers: [] };
    const b = JSON.parse(String(init.body)) as { startDate: number; endDate: number };
    const inWindow = usage.filter((u) => Number(u.timestamp) >= b.startDate && Number(u.timestamp) < b.endDate);
    return { totalUsageEventsCount: inWindow.length, pagination: { numPages: 1, currentPage: 1, pageSize: 1000, hasNextPage: false }, usageEvents: inWindow };
  });

  it("stores each event with what it was charged, or the model cost when it was included in the plan", async () => {
    await connect(cursor);
    const r = await syncSource(db, appId, cursor, { fetch: api, now });
    expect(r).toMatchObject({ stored: 2, more: false });
    const stored = (await events()).sort((a, b) => a.userId.localeCompare(b.userId));
    expect(stored.map((e) => [e.source, e.userId, e.provider, e.inputTokens, e.cachedTokens, Number(e.costUsd), e.costSource])).toEqual([
      ["cursor", "dev@example.com", "anthropic", 1200, 9000, 0.12, "client"],
      ["cursor", "lead@example.com", "openai", 500, 0, 0.035, "client"],
    ]);
    const saved = await row("cursor");
    expect(saved.syncedUntil?.getTime()).toBe(floorHour(now.getTime() - 2 * HOUR));
    expect(saved.lastError).toBeNull();
    expect(saved.lockedUntil).toBeNull();

    // The next sync starts where this one stopped, and a window read twice stores nothing twice.
    await db.update(schema.appSources).set({ syncedUntil: new Date(hoursAgo(60)) });
    await syncSource(db, appId, cursor, { fetch: api, now });
    expect(await events()).toHaveLength(2);
  });

  it("records a refused key and leaves the progress where it was", async () => {
    await connect(cursor, "wrong");
    const r = await syncSource(db, appId, cursor, { fetch: api, now });
    expect(r).toMatchObject({ stored: 0 });
    const saved = await row("cursor");
    expect(saved.lastError).toMatch(/Cursor refused the key/);
    expect(saved.syncedUntil).toBeNull();
    expect(await cursor.check("wrong", api)).toMatch(/refused/);
    expect(await cursor.check("test-key", api)).toBeNull();
  });

  it("does not run two syncs of one source at once", async () => {
    await connect(cursor);
    await db.update(schema.appSources).set({ lockedUntil: new Date(Date.now() + 60_000) });
    expect(await syncSource(db, appId, cursor, { fetch: api, now })).toBe("busy");
    expect(await syncSource(db, appId, openai, { fetch: api, now })).toBe("missing");
  });
});

describe("OpenAI", () => {
  const hour = hoursAgo(5) / 1000;
  const api = fake((url) => {
    const path = url.pathname.replace("/v1/organization/", "");
    if (path === "users") return { data: [{ id: "user-1", email: "a@example.com" }], has_more: false };
    const start = Number(url.searchParams.get("start_time"));
    const end = Number(url.searchParams.get("end_time"));
    expect(url.searchParams.getAll("group_by")).toEqual(["user_id", "api_key_id", "model"]);
    const results: Record<string, Record<string, unknown>[]> = {
      "usage/completions": [
        { model: "gpt-4o-2024-08-06", user_id: "user-1", api_key_id: "key_1", input_tokens: 1_000_000, input_cached_tokens: 200_000, input_uncached_tokens: 800_000, output_tokens: 100_000, num_model_requests: 5 },
        { model: "gpt-4o", user_id: null, api_key_id: "key_2", input_tokens: 0, output_tokens: 0, num_model_requests: 0 },
        { model: "gpt-4o", user_id: null, api_key_id: "key_3", input_tokens: 1000, input_cached_tokens: 0, output_tokens: 10, num_model_requests: 1 },
      ],
      "usage/audio_transcriptions": [{ model: "whisper-1", user_id: "user-1", api_key_id: "key_1", seconds: 90, num_model_requests: 2 }],
    };
    const inWindow = hour >= start && hour < end;
    return { data: inWindow ? [{ start_time: hour, end_time: hour + 3600, results: results[path] ?? [] }] : [], has_more: false, next_page: null };
  });

  it("stores an hour's usage per member, key and model, priced from the table", async () => {
    await connect(openai);
    const r = await syncSource(db, appId, openai, { fetch: api, now });
    expect(r).toMatchObject({ stored: 3, more: false });
    const stored = (await events()).sort((a, b) => a.userId.localeCompare(b.userId) || a.model.localeCompare(b.model));
    expect(stored.map((e) => [e.userId, e.model, e.inputTokens, e.cachedTokens, e.units === null ? null : Number(e.units), e.unit])).toEqual([
      ["a@example.com", "gpt-4o-2024-08-06", 800_000, 200_000, null, null],
      ["a@example.com", "whisper-1", 0, 0, 1.5, "minute"],
      ["api-key:key_3", "gpt-4o", 1000, 0, null, null],
    ]);
    expect(Number(stored[0]!.costUsd)).toBeCloseTo(3.25, 6);
    expect(stored.every((e) => e.source === "openai" && e.ts.getTime() === hour * 1000)).toBe(true);
  });
});

describe("Anthropic", () => {
  const refreshed = new Date(hoursAgo(3) + 20 * 60_000).toISOString();
  const usage = (h: number, actor: unknown, product: string, input: number) => ({
    starting_at: new Date(hoursAgo(h)).toISOString(),
    ending_at: new Date(hoursAgo(h - 1)).toISOString(),
    group: { actor, model: "claude-sonnet-4-5", product },
    usage: { uncached_input_tokens: input, cache_read_input_tokens: 100, cache_creation: { ephemeral_1h_input_tokens: 10, ephemeral_5m_input_tokens: 5 }, output_tokens: 50, total_tokens: input + 165, requests: 3 },
  });
  const rows = [
    usage(6, { type: "user_actor", email_address: "b@example.com", user_id: "user_b", name: "B", deleted: false }, "messages_api", 1000),
    usage(6, { type: "user_actor", email_address: "b@example.com", user_id: "user_b", name: "B", deleted: false }, "claude_code", 2000),
    usage(5, { type: "api_actor", api_key_id: "apikey_9" }, "messages_api", 500),
    // After data_refreshed_at: read by a later sync.
    usage(2, { type: "api_actor", api_key_id: "apikey_9" }, "messages_api", 700),
  ];
  const handler =
    (auth: "x-api-key" | "bearer"): Handler =>
    (url, init) => {
      const ok = auth === "x-api-key" ? header(init, "x-api-key") === "test-key" : header(init, "authorization") === "Bearer test-key";
      if (!ok) return { status: 401 };
      expect(header(init, "anthropic-beta")).toBe("analytics-usage-cost-2026-08-24");
      const from = new Date(url.searchParams.get("starting_at")!).getTime();
      const to = new Date(url.searchParams.get("ending_at")!).getTime();
      const data = rows.filter((r) => new Date(r.starting_at).getTime() >= from && new Date(r.starting_at).getTime() < to);
      return { data, has_more: false, next_page: null, data_refreshed_at: refreshed };
    };

  it("stores refreshed hours per member or key and product, and stops at the refresh time", async () => {
    await connect(anthropic);
    const r = await syncSource(db, appId, anthropic, { fetch: fake(handler("x-api-key")), now });
    expect(r).toMatchObject({ stored: 3, more: false });
    const stored = (await events()).sort((a, b) => a.userId.localeCompare(b.userId) || a.feature!.localeCompare(b.feature!));
    expect(stored.map((e) => [e.source, e.userId, e.feature, e.inputTokens, e.cachedTokens, e.cacheWriteTokens])).toEqual([
      ["anthropic", "api-key:apikey_9", "messages_api", 500, 100, 15],
      ["anthropic", "b@example.com", "claude_code", 2000, 100, 15],
      ["anthropic", "b@example.com", "messages_api", 1000, 100, 15],
    ]);
    expect((await row("anthropic")).syncedUntil?.getTime()).toBe(hoursAgo(3));
  });

  it("skips Claude Code usage when Claude Code sends its own export, and tries a bearer token", async () => {
    await ingestEvents(db, appId, [
      { id: await stableUuid("cc"), userId: "b@example.com", ts: new Date(), provider: "anthropic", model: "claude-sonnet-4-5", inputTokens: 1, outputTokens: 1, cachedTokens: 0, cacheWriteTokens: 0, source: "claude-code" },
    ]);
    await connect(anthropic);
    const r = await syncSource(db, appId, anthropic, { fetch: fake(handler("bearer")), now });
    expect(r).toMatchObject({ stored: 2 });
    expect((await events()).filter((e) => e.source === "anthropic").map((e) => e.feature)).toEqual(["messages_api", "messages_api"]);
  });
});

describe("POST /sources/sync", () => {
  it("needs the server secret and a known source", async () => {
    const app = new Hono().route("/sources", syncRoute(() => db));
    const post = (auth: string, body: unknown) => app.request("/sources/sync", { method: "POST", headers: { authorization: auth }, body: JSON.stringify(body) });
    expect((await post("Bearer nope", { appId, source: "cursor" })).status).toBe(401);
    expect((await post("Bearer test-secret", { appId, source: "nope" })).status).toBe(400);
    const checked = new Hono().route("/sources", syncRoute(() => db, fake(() => ({ status: 401 }))));
    const res = await checked.request("/sources/check", { method: "POST", headers: { authorization: "Bearer test-secret" }, body: JSON.stringify({ source: "openai", key: "sk-admin-x" }) });
    expect(await res.json()).toEqual({ problem: expect.stringMatching(/OpenAI refused the key/) });
  });
});
