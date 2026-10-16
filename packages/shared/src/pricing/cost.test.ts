import { describe, expect, it } from "vitest";
import { cost, modelCandidates, type ModelPrice, type PriceOverride } from "./cost";
import { MODEL_PRICES } from "./prices";

const at = new Date("2026-10-16T12:00:00Z");
const M = 1_000_000;

const prices: ModelPrice[] = [
  { provider: "openai", model: "gpt-x", effectiveFrom: "2024-01-01", input: 2, output: 10, cached: 0.5 },
  { provider: "openai", model: "gpt-x", effectiveFrom: "2026-11-01", input: 4, output: 20, cached: 1 },
  { provider: "openai", model: "gpt-x-2024-05-13", effectiveFrom: "2024-01-01", input: 5, output: 15 },
  {
    provider: "anthropic",
    model: "claude-y",
    effectiveFrom: "2024-01-01",
    input: 1,
    output: 5,
    cached: 0.1,
    cacheWrite: 1.25,
    long: { threshold: 100_000, input: 2, output: 10, cached: 0.2, cacheWrite: 2.5 },
  },
];

describe("cost", () => {
  it("prices input and output tokens", () => {
    const c = cost({ provider: "openai", model: "gpt-x", at, inputTokens: M, outputTokens: M }, prices);
    expect(c).toEqual({ costUsd: 12, source: "table" });
  });

  it("prices cache reads and writes separately", () => {
    const c = cost(
      {
        provider: "anthropic",
        model: "claude-y",
        at,
        inputTokens: 1000,
        outputTokens: 1000,
        cachedTokens: 10_000,
        cacheWriteTokens: 2000,
      },
      prices,
    );
    // 1000*1 + 1000*5 + 10000*0.1 + 2000*1.25 = 9500 micro-dollars
    expect(c?.costUsd).toBe(0.0095);
  });

  it("bills cache reads at the input price when there is no cached price", () => {
    const c = cost(
      { provider: "openai", model: "gpt-x-2024-05-13", at, inputTokens: 0, outputTokens: 0, cachedTokens: M },
      prices,
    );
    expect(c?.costUsd).toBe(5);
  });

  it("switches to long context rates above the threshold, counting cached tokens", () => {
    const base = { provider: "anthropic", model: "claude-y", at, outputTokens: 0 };
    expect(cost({ ...base, inputTokens: 100_000 }, prices)?.costUsd).toBe(0.1);
    expect(cost({ ...base, inputTokens: 50_000, cachedTokens: 50_001 }, prices)?.costUsd).toBe(0.1100002);
  });

  it("uses the price in effect on the event date", () => {
    const usage = { provider: "openai", model: "gpt-x", inputTokens: M, outputTokens: 0 };
    expect(cost({ ...usage, at: new Date("2026-10-31T23:59:59Z") }, prices)?.costUsd).toBe(2);
    expect(cost({ ...usage, at: new Date("2026-11-01T00:00:00Z") }, prices)?.costUsd).toBe(4);
  });

  it("matches dated and prefixed model ids, preferring an exact dated price", () => {
    const usage = { provider: "OpenAI", at, inputTokens: M, outputTokens: 0 };
    expect(cost({ ...usage, model: "gpt-x-2025-08-06" }, prices)?.costUsd).toBe(2);
    expect(cost({ ...usage, model: "models/GPT-X" }, prices)?.costUsd).toBe(2);
    expect(cost({ ...usage, model: "gpt-x-2024-05-13" }, prices)?.costUsd).toBe(5);
  });

  it("does not match a model by prefix", () => {
    expect(cost({ provider: "openai", model: "gpt-x-mini", at, inputTokens: 1, outputTokens: 1 }, prices)).toBeNull();
  });

  it("returns null for an unknown model or provider", () => {
    expect(cost({ provider: "fal", model: "flux", at, inputTokens: 1, outputTokens: 1 }, prices)).toBeNull();
  });

  it("rounds to 8 decimal places", () => {
    const c = cost({ provider: "openai", model: "gpt-x", at, inputTokens: 1, outputTokens: 0, cachedTokens: 1 }, prices);
    expect(c?.costUsd).toBe(0.0000025);
  });
});

describe("cost with overrides", () => {
  const usage = { provider: "openai", model: "gpt-x", at, inputTokens: M, outputTokens: M };

  it("applies a provider-wide discount", () => {
    const o: PriceOverride[] = [{ provider: "openai", model: "*", effectiveFrom: "2024-01-01", discountPct: 20 }];
    expect(cost(usage, prices, o)).toEqual({ costUsd: 9.6, source: "override" });
  });

  it("lets a model override win over the provider-wide one", () => {
    const o: PriceOverride[] = [
      { provider: "openai", model: "*", effectiveFrom: "2024-01-01", discountPct: 20 },
      { provider: "openai", model: "gpt-x", effectiveFrom: "2024-01-01", rates: { input: 1, output: 1 } },
    ];
    expect(cost(usage, prices, o)).toEqual({ costUsd: 2, source: "override" });
  });

  it("prices a model missing from the list with flat rates", () => {
    const o: PriceOverride[] = [
      { provider: "openai", model: "ft:gpt-x:acme", effectiveFrom: "2024-01-01", rates: { input: 3, output: 6 } },
    ];
    expect(cost({ ...usage, model: "ft:gpt-x:acme" }, prices, o)?.costUsd).toBe(9);
  });

  it("ignores an override that starts after the event", () => {
    const o: PriceOverride[] = [{ provider: "openai", model: "*", effectiveFrom: "2027-01-01", discountPct: 50 }];
    expect(cost(usage, prices, o)).toEqual({ costUsd: 12, source: "table" });
  });

  it("discounts the long context rates too", () => {
    const o: PriceOverride[] = [{ provider: "anthropic", model: "*", effectiveFrom: "2024-01-01", discountPct: 50 }];
    const c = cost({ provider: "anthropic", model: "claude-y", at, inputTokens: 200_000, outputTokens: 0 }, prices, o);
    expect(c?.costUsd).toBe(0.2);
  });
});

describe("modelCandidates", () => {
  it("strips both date formats", () => {
    expect(modelCandidates("claude-opus-4-5-20251101")).toEqual(["claude-opus-4-5-20251101", "claude-opus-4-5"]);
    expect(modelCandidates("gpt-4o-2024-08-06")).toEqual(["gpt-4o-2024-08-06", "gpt-4o"]);
  });
});

describe("MODEL_PRICES", () => {
  it("has no duplicate rows", () => {
    const keys = MODEL_PRICES.map((p) => `${p.provider}/${p.model}/${p.effectiveFrom}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has lower-case ids and sane prices", () => {
    for (const p of MODEL_PRICES) {
      expect(p.model).toBe(p.model.toLowerCase());
      expect(p.input).toBeGreaterThan(0);
      expect(p.output).toBeGreaterThanOrEqual(p.input);
      if (p.cached !== undefined) expect(p.cached).toBeLessThanOrEqual(p.input);
    }
  });

  it("prices a real model end to end", () => {
    const c = cost(
      { provider: "anthropic", model: "claude-haiku-4-5-20251001", at, inputTokens: M, outputTokens: M },
      MODEL_PRICES,
    );
    expect(c).toEqual({ costUsd: 6, source: "table" });
  });
});
