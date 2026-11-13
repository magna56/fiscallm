import { cost, modelCandidates, type ModelPrice } from "./cost";
import { MODEL_PRICES } from "./prices";

// The price table as other programs read it: the public pricing API, the MCP
// server and the pricing pages all use this one view of it.

/** When the table was last audited against the providers' pricing pages (ACCURACY.md). */
export const PRICES_CHECKED = "2026-10-18";

// Media and legacy models, and dated snapshots ("gpt-4-0613",
// "gpt-4o-2024-05-13") that would be near-duplicates of the undated model.
export const NOT_A_TEXT_MODEL = /image|tts|transcribe|whisper|realtime|audio|live|veo|davinci|babbage|instruct|embedding|-\d{4}$|-\d{4}-\d{2}-\d{2}$/;

/** A current text model with a page at fiscallm.com/llm-pricing/<model>. */
export const isTextModel = (p: ModelPrice) =>
  ["openai", "anthropic", "google"].includes(p.provider) && !p.units && !NOT_A_TEXT_MODEL.test(p.model) && p.input > 0;

export interface ListedPrice {
  price: ModelPrice;
  /** A later listed price, e.g. an announced increase. */
  next?: ModelPrice;
}

/** The price in force on `day` (YYYY-MM-DD) for every model, with the next announced change. */
export function currentPrices(day = new Date().toISOString().slice(0, 10)): ListedPrice[] {
  const byModel = new Map<string, ModelPrice[]>();
  for (const p of MODEL_PRICES) {
    const key = `${p.provider}/${p.model}`;
    byModel.set(key, [...(byModel.get(key) ?? []), p]);
  }
  const out: ListedPrice[] = [];
  for (const rows of byModel.values()) {
    const sorted = [...rows].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    const price = sorted.filter((r) => r.effectiveFrom <= day).at(-1);
    if (price) out.push({ price, next: sorted.find((r) => r.effectiveFrom > day) });
  }
  return out;
}

/** A model by id; "openai/gpt-4o" and dated snapshots ("gpt-4o-2024-08-06") also match. */
export function findListed(model: string, day = new Date().toISOString().slice(0, 10)): ListedPrice | undefined {
  const all = currentPrices(day);
  for (const id of modelCandidates(model.replace(/^.*\//, ""))) {
    const hit = all.find((l) => l.price.model === id);
    if (hit) return hit;
  }
  return undefined;
}

export interface EstimateInput {
  model: string;
  /** All prompt tokens, including any read from or written to the cache. */
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
  calls?: number;
}

export interface Estimate {
  provider: string;
  model: string;
  /** USD for one call. */
  costUsd: number;
  calls: number;
  /** USD for all calls. */
  totalUsd: number;
}

/** List-price cost of a call, or null when the model is not in the table. */
export function estimateCost(e: EstimateInput, at = new Date()): Estimate | null {
  const day = at.toISOString().slice(0, 10);
  const listed = findListed(e.model, day);
  if (!listed) return null;
  const cachedTokens = Math.max(0, e.cachedTokens ?? 0);
  const cacheWriteTokens = Math.max(0, e.cacheWriteTokens ?? 0);
  const c = cost(
    {
      provider: listed.price.provider,
      model: listed.price.model,
      at,
      inputTokens: Math.max(0, e.inputTokens - cachedTokens - cacheWriteTokens),
      outputTokens: Math.max(0, e.outputTokens),
      cachedTokens,
      cacheWriteTokens,
    },
    MODEL_PRICES,
  );
  if (!c) return null;
  const calls = Math.max(1, Math.round(e.calls ?? 1));
  return { provider: listed.price.provider, model: listed.price.model, costUsd: c.costUsd, calls, totalUsd: Math.round(c.costUsd * calls * 1e8) / 1e8 };
}
