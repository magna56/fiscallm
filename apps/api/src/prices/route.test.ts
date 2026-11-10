import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { pricesRoute } from "./route";

const api = () => new Hono().route("/v1", pricesRoute());
const get = async (path: string) => {
  const res = await api().request(path);
  return { res, json: (await res.json()) as Record<string, any> };
};

describe("public prices API", () => {
  it("lists current prices, open to any origin", async () => {
    const { res, json } = await get("/v1/prices");
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toContain("max-age");
    expect(json.currency).toBe("USD");
    expect(json.count).toBe(json.models.length);
    const gpt4o = json.models.find((m: { id: string }) => m.id === "gpt-4o");
    expect(gpt4o).toMatchObject({ provider: "openai", inputPerMtok: 2.5, outputPerMtok: 10, url: "https://fiscallm.com/llm-pricing/gpt-4o" });
    // One row per model, however many dated prices the table holds.
    expect(new Set(json.models.map((m: { id: string; provider: string }) => `${m.provider}/${m.id}`)).size).toBe(json.models.length);
  });

  it("filters by provider and by text", async () => {
    const { json } = await get("/v1/prices?provider=anthropic&q=haiku");
    expect(json.models.length).toBeGreaterThan(0);
    expect(json.models.every((m: { id: string; provider: string }) => m.provider === "anthropic" && m.id.includes("haiku"))).toBe(true);
  });

  it("returns one model, also by a dated or prefixed id", async () => {
    expect((await get("/v1/prices/gpt-4o")).json.model.id).toBe("gpt-4o");
    expect((await get("/v1/prices/gpt-4o-2024-08-06")).json.model.id).toBe("gpt-4o");
    expect((await get("/v1/prices/openai/gpt-4o")).json.model.id).toBe("gpt-4o");
    expect((await get("/v1/prices/not-a-model")).res.status).toBe(404);
  });

  it("estimates a call", async () => {
    const { json } = await get("/v1/estimate?model=gpt-4o&input=1000000&output=100000&calls=10");
    expect(json).toMatchObject({ provider: "openai", model: "gpt-4o", costUsd: 3.5, calls: 10, totalUsd: 35 });
    // Cached tokens are part of the input and billed at the cached rate.
    const cached = (await get("/v1/estimate?model=gpt-4o&input=1000000&output=0&cached=1000000")).json;
    expect(cached.costUsd).toBe(1.25);
  });

  it("explains a bad estimate request", async () => {
    expect((await get("/v1/estimate?model=gpt-4o")).res.status).toBe(400);
    expect((await get("/v1/estimate?model=gpt-4o&input_tokens=5")).res.status).toBe(400);
    expect((await get("/v1/estimate?model=gpt-4o&output=5")).res.status).toBe(200);
    expect((await get("/v1/estimate?input=5")).res.status).toBe(400);
    expect((await get("/v1/estimate?model=gpt-4o&input=-5")).res.status).toBe(400);
    expect((await get("/v1/estimate?model=nope&input=5&output=5")).res.status).toBe(404);
  });
});
