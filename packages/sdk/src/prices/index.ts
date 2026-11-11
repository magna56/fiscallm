// `import { estimateCost, priceOf } from "fiscallm/prices"`
//
// List prices for OpenAI, Anthropic and Google models, and the cost of a
// call, with no network request and no dependencies. The table is the one
// fiscallm.com uses; it changes only when you update the package. For prices
// that are always current, call https://fiscallm.com/api/v1/prices.

import type { ModelPrice } from "./cost.js";
import { MODEL_PRICES } from "./prices.js";
import { currentPrices, findListed, isTextModel } from "./public.js";

export { cost } from "./cost.js";
export type { Cost, ModelPrice, Rates, Usage } from "./cost.js";
export { estimateCost, PRICES_CHECKED } from "./public.js";
export type { Estimate, EstimateInput } from "./public.js";

/** Every price row, including earlier prices of a model (see `effectiveFrom`). USD per million tokens. */
export { MODEL_PRICES };

/**
 * The list price of a model today (or on `day`, YYYY-MM-DD), in USD per
 * million tokens. "openai/gpt-4o" and dated snapshots ("gpt-4o-2024-08-06")
 * match too. Undefined when the model is not in the table.
 */
export function priceOf(model: string, day?: string): ModelPrice | undefined {
  return findListed(model, day)?.price;
}

/** The current price of every text model, cheapest input first. */
export function listPrices(day?: string): ModelPrice[] {
  return currentPrices(day)
    .map((l) => l.price)
    .filter(isTextModel)
    .sort((a, b) => a.input - b.input || a.model.localeCompare(b.model));
}
