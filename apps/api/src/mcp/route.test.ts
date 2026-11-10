import { Hono } from "hono";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "../ingest/db";
import { ingestEvents } from "../ingest/pipeline";
import { metricsRoute } from "../metrics/route";
import { freshApp, testDb } from "../test/app";
import { mcpRoute, TOOLS } from "./route";

let db: AnyDb;
let appId: string;
let key: string;
const api = () =>
  new Hono()
    .route("/mcp", mcpRoute(() => db))
    .route("/v1/metrics", metricsRoute(() => db));

beforeAll(async () => {
  db = await testDb();
});
beforeEach(async () => {
  ({ appId, key } = await freshApp(db));
  const event = (userId: string, inputTokens: number, feature: string) => ({
    id: crypto.randomUUID(),
    userId,
    ts: new Date(),
    provider: "openai",
    model: "gpt-4o",
    inputTokens,
    outputTokens: 0,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    feature,
  });
  // gpt-4o input is $2.50 per 1M tokens: $5 for the whale, $0.25 for the other.
  await ingestEvents(db, appId, [event("whale", 2_000_000, "chat"), event("light", 100_000, "search")]);
});

let nextId = 1;
async function rpc(method: string, params?: unknown, headers: Record<string, string> = {}) {
  const res = await api().request("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
  return { res, json: (await res.json()) as Record<string, any> };
}
async function call(name: string, args: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const { json } = await rpc("tools/call", { name, arguments: args }, headers);
  const text = json.result.content[0].text as string;
  return { isError: json.result.isError === true, text, data: json.result.isError ? undefined : JSON.parse(text) };
}
const auth = () => ({ authorization: `Bearer ${key}` });

describe("MCP server", () => {
  it("initializes with the version the client asked for", async () => {
    const { res, json } = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(json.result).toMatchObject({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "fiscallm" } });
    expect((await rpc("initialize", { protocolVersion: "1999-01-01" })).json.result.protocolVersion).toBe("2025-11-25");
  });

  it("accepts notifications with 202 and no body", async () => {
    const res = await api().request("/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("has no stream to open, and answers CORS preflight", async () => {
    expect((await api().request("/mcp")).status).toBe(405);
    const pre = await api().request("/mcp", { method: "OPTIONS" });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-headers")).toContain("authorization");
  });

  it("lists tools with a schema each, and reports unknown methods and tools", async () => {
    const { json } = await rpc("tools/list");
    expect(json.result.tools.map((t: { name: string }) => t.name)).toEqual(TOOLS.map((t) => t.name));
    for (const t of json.result.tools) {
      expect(t.inputSchema.type).toBe("object");
      expect(t.description.length).toBeGreaterThan(20);
    }
    expect((await rpc("ping")).json.result).toEqual({});
    expect((await rpc("nope/nope")).json.error.code).toBe(-32601);
    expect((await rpc("tools/call", { name: "nope" })).json.error.code).toBe(-32602);
  });

  it("rejects a body that is not one JSON-RPC message", async () => {
    const send = (body: string) => api().request("/mcp", { method: "POST", headers: { "content-type": "application/json" }, body });
    expect((await send("nope")).status).toBe(400);
    expect((await send("[]")).status).toBe(400);
  });

  it("answers price questions with no key", async () => {
    const list = await call("list_llm_prices", { provider: "openai", search: "gpt-4o" });
    expect(list.data.models.some((m: { id: string }) => m.id === "gpt-4o")).toBe(true);
    expect((await call("get_llm_price", { model: "gpt-4o" })).data.model).toMatchObject({ inputPerMtok: 2.5, outputPerMtok: 10 });
    expect((await call("estimate_llm_cost", { model: "gpt-4o", inputTokens: 1_000_000, outputTokens: 100_000, calls: 2 })).data).toMatchObject({ costUsd: 3.5, totalUsd: 7 });
    const misnamed = await call("estimate_llm_cost", { model: "gpt-4o", input_tokens: 1000, output_tokens: 500 });
    expect(misnamed.isError).toBe(true);
    expect(misnamed.text).toContain("inputTokens");
    const unknown = await call("get_llm_price", { model: "gpt-nope" });
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toContain("list_llm_prices");
  });

  it("compares models, cheapest first", async () => {
    const { data } = await call("compare_llm_costs", { models: ["gpt-4o", "gpt-4o-mini"], inputTokens: 1000, outputTokens: 500, calls: 1000 });
    expect(data.results.map((r: { model: string }) => r.model)).toEqual(["gpt-4o-mini", "gpt-4o"]);
    expect(data.results[0].timesCheapest).toBe(1);
    expect(data.results[1].timesCheapest).toBeGreaterThan(1);
    expect((await call("compare_llm_costs", { models: ["gpt-4o"], inputTokens: 1, outputTokens: 1 })).isError).toBe(true);
  });

  it("works out a plan's break-even", async () => {
    const { data } = await call("subscription_break_even", { model: "gpt-4o", monthlyPriceUsd: 10, feePercent: 15, inputTokens: 1000, outputTokens: 250, messagesPerMonth: 2000 });
    // $0.0025 + $0.0025 a message against $8.50 net.
    expect(data).toMatchObject({ costPerMessageUsd: 0.005, netRevenuePerMonthUsd: 8.5, breakEvenMessagesPerMonth: 1700 });
    expect(data.atMessagesPerMonth).toMatchObject({ aiCostUsd: 10, marginUsd: -1.5, losesMoney: true });
  });

  it("asks for a key on data tools instead of failing the request", async () => {
    const none = await call("get_margin_overview");
    expect(none.isError).toBe(true);
    expect(none.text).toContain("Authorization");
    expect((await call("get_margin_overview", {}, { authorization: "Bearer fsk_nope" })).isError).toBe(true);
  });

  it("reads the app's numbers with its key", async () => {
    const overview = await call("get_margin_overview", { days: 7 }, auth());
    expect(overview.data).toMatchObject({ days: 7, costUsd: 5.25, requests: 2 });
    const users = await call("list_users_by_margin", { limit: 1 }, auth());
    expect(users.data.users).toHaveLength(1);
    expect(users.data.users[0]).toMatchObject({ userId: "whale", costUsd: 5 });
    const breakdown = await call("get_cost_breakdown", {}, auth());
    expect(JSON.stringify(breakdown.data)).toContain("search");
    expect((await call("get_plan_margins", {}, auth())).isError).toBe(false);
  });
});

describe("GET /v1/metrics", () => {
  const get = (path: string, headers: Record<string, string> = auth()) => api().request(`/v1/metrics${path}`, { headers });

  it("needs the app's key", async () => {
    expect((await get("/overview", {})).status).toBe(401);
    expect((await get("/overview", { authorization: "Bearer fsk_nope" })).status).toBe(401);
  });

  it("returns the overview, users, plans and breakdown", async () => {
    expect(await (await get("/overview?days=7")).json()).toMatchObject({ days: 7, costUsd: 5.25, usersWithCost: 2 });
    const users = (await (await get("/users?limit=5")).json()) as { users: { userId: string }[] };
    expect(users.users.map((u) => u.userId)).toEqual(["whale", "light"]);
    expect((await get("/plans")).status).toBe(200);
    expect((await get("/breakdown")).status).toBe(200);
    // Out-of-range values fall back to the limits.
    expect(await (await get("/overview?days=9999")).json()).toMatchObject({ days: 365 });
  });
});
