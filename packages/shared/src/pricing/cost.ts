// Prices are USD per million tokens. Dates are YYYY-MM-DD, compared in UTC.

export type Provider = "openai" | "anthropic" | "google" | (string & {});

export interface Rates {
  input: number;
  output: number;
  // Missing: cache reads or writes are billed at the input price.
  cached?: number;
  cacheWrite?: number;
}

export interface ModelPrice extends Rates {
  provider: Provider;
  model: string;
  effectiveFrom: string;
  // Prompts over `threshold` tokens are billed at these rates instead.
  long?: Rates & { threshold: number };
}

export interface PriceOverride {
  provider: Provider;
  // "*" covers every model of the provider; an exact model wins over it.
  model: string;
  effectiveFrom: string;
  // Percent off the list price, 0 to 100.
  discountPct?: number;
  // Flat prices of the customer's own; used instead of the list price.
  rates?: Rates;
}

export interface Usage {
  provider: Provider;
  model: string;
  at: Date;
  // Excludes cache reads and cache writes.
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
}

export interface Cost {
  costUsd: number;
  source: "table" | "override";
}

const DATE_SUFFIX = /-(\d{4}-\d{2}-\d{2}|\d{8})$/;

// Ids to try, most specific first: "models/gpt-4o-2024-08-06" also
// matches a "gpt-4o" price, but an exact dated price wins when listed.
export function modelCandidates(model: string): string[] {
  const id = model.trim().toLowerCase().replace(/^models\//, "");
  const undated = id.replace(DATE_SUFFIX, "");
  return undated === id ? [id] : [id, undated];
}

function latest<T extends { provider: string; model: string; effectiveFrom: string }>(
  rows: readonly T[],
  provider: string,
  model: string,
  day: string,
): T | undefined {
  let best: T | undefined;
  for (const r of rows) {
    if (r.provider !== provider || r.model !== model || r.effectiveFrom > day) continue;
    if (!best || r.effectiveFrom > best.effectiveFrom) best = r;
  }
  return best;
}

function findPrice(prices: readonly ModelPrice[], provider: string, ids: string[], day: string) {
  for (const id of ids) {
    const p = latest(prices, provider, id, day);
    if (p) return p;
  }
  return undefined;
}

function findOverride(
  overrides: readonly PriceOverride[],
  provider: string,
  ids: string[],
  day: string,
) {
  for (const id of [...ids, "*"]) {
    const o = latest(overrides, provider, id, day);
    if (o) return o;
  }
  return undefined;
}

function charge(u: Usage, r: Rates): number {
  const cached = u.cachedTokens ?? 0;
  const written = u.cacheWriteTokens ?? 0;
  const micro =
    u.inputTokens * r.input +
    u.outputTokens * r.output +
    cached * (r.cached ?? r.input) +
    written * (r.cacheWrite ?? r.input);
  // numeric(18, 8) in the database.
  return Math.round(micro * 100) / 1e8;
}

function scale(r: Rates, factor: number): Rates {
  return {
    input: r.input * factor,
    output: r.output * factor,
    cached: r.cached === undefined ? undefined : r.cached * factor,
    cacheWrite: r.cacheWrite === undefined ? undefined : r.cacheWrite * factor,
  };
}

/**
 * Cost of one AI call, or null when the model has no list price and no
 * flat override (shown as "unpriced" in the dashboard).
 */
export function cost(
  usage: Usage,
  prices: readonly ModelPrice[],
  overrides: readonly PriceOverride[] = [],
): Cost | null {
  const provider = usage.provider.toLowerCase();
  const ids = modelCandidates(usage.model);
  const day = usage.at.toISOString().slice(0, 10);

  const override = findOverride(overrides, provider, ids, day);
  if (override?.rates) return { costUsd: charge(usage, override.rates), source: "override" };

  const price = findPrice(prices, provider, ids, day);
  if (!price) return null;

  const prompt = usage.inputTokens + (usage.cachedTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
  let rates: Rates = price.long && prompt > price.long.threshold ? price.long : price;

  if (override?.discountPct !== undefined) {
    rates = scale(rates, 1 - override.discountPct / 100);
    return { costUsd: charge(usage, rates), source: "override" };
  }
  return { costUsd: charge(usage, rates), source: "table" };
}
