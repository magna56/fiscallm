import { describe, expect, it } from "vitest";
import { cost } from "./cost";
import { MODEL_PRICES } from "./prices";

// Spot checks pinned to the providers' published list prices as read on
// 2026-10-18 (full audit in ACCURACY.md). If a provider changes a price, add a
// new dated row in prices.ts and update the expected value here with its date.
const at = new Date("2026-10-18T12:00:00Z");
const M = 1_000_000;

function usd(provider: string, model: string, usage: { inputTokens?: number; outputTokens?: number; cachedTokens?: number; cacheWriteTokens?: number }) {
  const c = cost({ provider, model, inputTokens: 0, outputTokens: 0, ...usage, at }, MODEL_PRICES);
  expect(c, `${provider}/${model} should be priced`).not.toBeNull();
  return c!.costUsd;
}

describe("built-in prices match the providers' pages (2026-10-18)", () => {
  it("OpenAI", () => {
    expect(usd("openai", "gpt-4o", { inputTokens: M, outputTokens: M })).toBeCloseTo(2.5 + 10, 6);
    expect(usd("openai", "gpt-4o", { cachedTokens: M })).toBeCloseTo(1.25, 6);
    expect(usd("openai", "gpt-4o-mini", { inputTokens: M, outputTokens: M })).toBeCloseTo(0.15 + 0.6, 6);
    expect(usd("openai", "gpt-5", { inputTokens: M, outputTokens: M })).toBeCloseTo(1.25 + 10, 6);
    expect(usd("openai", "gpt-5-mini", { inputTokens: M, outputTokens: M })).toBeCloseTo(0.25 + 2, 6);
    // Long prompts (over 272K tokens) use the long rates.
    expect(usd("openai", "gpt-5.5", { inputTokens: 300_000, outputTokens: 100_000 })).toBeCloseTo(0.3 * 10 + 0.1 * 45, 6);
  });

  it("OpenAI legacy models", () => {
    expect(usd("openai", "gpt-3.5-turbo", { inputTokens: M, outputTokens: M })).toBeCloseTo(0.5 + 1.5, 6);
    expect(usd("openai", "gpt-4-turbo-2024-04-09", { inputTokens: M, outputTokens: M })).toBeCloseTo(10 + 30, 6);
    expect(usd("openai", "gpt-4-0613", { inputTokens: M, outputTokens: M })).toBeCloseTo(30 + 60, 6);
    expect(usd("openai", "davinci-002", { inputTokens: M, outputTokens: M })).toBeCloseTo(2 + 2, 6);
  });

  it("Anthropic, including cache reads, cache writes and Haiku 5.5's two prompt-length tiers", () => {
    expect(usd("anthropic", "claude-sonnet-4-5", { inputTokens: M, outputTokens: M })).toBeCloseTo(3 + 15, 6);
    expect(usd("anthropic", "claude-sonnet-4-5", { cachedTokens: M })).toBeCloseTo(0.3, 6);
    expect(usd("anthropic", "claude-sonnet-4-5", { cacheWriteTokens: M })).toBeCloseTo(3.75, 6);
    expect(usd("anthropic", "claude-opus-4-5", { inputTokens: M, outputTokens: M })).toBeCloseTo(5 + 25, 6);
    // Up to 100,000 tokens of prompt: $0.10 in, $0.50 out. Over 100,000: $0.50 in, $2.50 out.
    expect(usd("anthropic", "claude-haiku-5-5", { inputTokens: 50_000, outputTokens: 10_000 })).toBeCloseTo(0.05 * 0.1 + 0.01 * 0.5, 6);
    expect(usd("anthropic", "claude-haiku-5-5", { inputTokens: 200_000, outputTokens: 10_000 })).toBeCloseTo(0.2 * 0.5 + 0.01 * 2.5, 6);
  });

  it("Gemini, including the prompt-size tier of 2.5 Pro", () => {
    expect(usd("google", "gemini-2.5-flash", { inputTokens: M, outputTokens: M })).toBeCloseTo(0.3 + 2.5, 6);
    expect(usd("google", "gemini-2.5-pro", { inputTokens: 100_000, outputTokens: 100_000 })).toBeCloseTo(0.1 * 1.25 + 0.1 * 10, 6);
    expect(usd("google", "gemini-2.5-pro", { inputTokens: 300_000, outputTokens: 100_000 })).toBeCloseTo(0.3 * 2.5 + 0.1 * 15, 6);
  });
});
