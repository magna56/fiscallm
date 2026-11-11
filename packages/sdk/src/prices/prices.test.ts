import { describe, expect, it } from "vitest";
// @ts-expect-error a plain script with no types
import { current, FILES, generated } from "../../scripts/sync-prices.mjs";
import { estimateCost, listPrices, MODEL_PRICES, priceOf, PRICES_CHECKED } from "./index.js";

describe("fiscallm/prices", () => {
  it("is the same table and maths as packages/shared (run scripts/sync-prices.mjs)", () => {
    for (const name of FILES as string[]) expect(current(name), `src/prices/${name}.ts is out of date`).toBe(generated(name));
  });

  it("finds a model by id, provider prefix or dated snapshot", () => {
    const p = priceOf("gpt-4o");
    expect(p).toMatchObject({ provider: "openai", model: "gpt-4o", input: 2.5, output: 10 });
    expect(priceOf("openai/gpt-4o")).toEqual(p);
    expect(priceOf("gpt-4o-2024-08-06")?.model).toBe("gpt-4o");
    expect(priceOf("not-a-model")).toBeUndefined();
  });

  it("prices a call, with cached input at the cached rate", () => {
    // gpt-4o: $2.50 in, $1.25 cached, $10 out per 1M tokens.
    expect(estimateCost({ model: "gpt-4o", inputTokens: 1_000_000, outputTokens: 100_000 })?.costUsd).toBeCloseTo(3.5, 8);
    expect(estimateCost({ model: "gpt-4o", inputTokens: 1_000_000, outputTokens: 0, cachedTokens: 1_000_000 })?.costUsd).toBeCloseTo(1.25, 8);
    expect(estimateCost({ model: "gpt-4o", inputTokens: 1000, outputTokens: 500, calls: 3 })).toMatchObject({ calls: 3 });
    expect(estimateCost({ model: "not-a-model", inputTokens: 1, outputTokens: 1 })).toBeNull();
  });

  it("lists current text models, cheapest first", () => {
    const all = listPrices();
    expect(all.length).toBeGreaterThan(20);
    expect(all.length).toBeLessThan(MODEL_PRICES.length);
    expect(all[0]!.input).toBeLessThanOrEqual(all.at(-1)!.input);
    expect(new Set(all.map((p) => `${p.provider}/${p.model}`)).size).toBe(all.length);
    expect(PRICES_CHECKED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
