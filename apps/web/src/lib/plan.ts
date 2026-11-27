import type { ModelPrice } from "@fiscallm/shared";
import { findModel, messageCost, popularModels, type TextModel } from "./models";

// Pricing-plan math shared by the planner's static pages and guides. Same
// formulas as components/pricing-planner.tsx, computed at build time so the
// numbers are in the HTML for search engines and AI crawlers.

/** Defaults: a chat turn with half the prompt from cache, 15% store fee, 70% target AI margin. */
export const PLAN_DEFAULTS = { cachedShare: 0.5, fee: 0.15, target: 0.7, heavyX: 5, freeRatio: 10 } as const;

export const actionCost = (p: ModelPrice) => messageCost(p, { cachedShare: PLAN_DEFAULTS.cachedShare });

/** Lowest monthly price that keeps the target margin for a user doing `actions` a month, rounded up to .99. */
export function minPrice(cost: number, actions: number, target: number = PLAN_DEFAULTS.target, fee: number = PLAN_DEFAULTS.fee) {
  const raw = (cost * actions) / (1 - target) / (1 - fee);
  return raw <= 0 ? 0 : Math.max(0.99, Math.ceil(raw + 0.01) - 0.01);
}

/** Most actions a month one user can take before a plan at `price` earns less than the target margin. */
export const paidLimit = (cost: number, price: number, target: number = PLAN_DEFAULTS.target, fee: number = PLAN_DEFAULTS.fee) =>
  cost > 0 ? Math.floor((price * (1 - fee) * (1 - target)) / cost) : Infinity;

/** Largest free allowance a month, given one paid plan used `paidActions` times and `ratio` free users per payer. */
export function freeLimit(cost: number, price: number, paidActions: number, ratio: number = PLAN_DEFAULTS.freeRatio, target: number = PLAN_DEFAULTS.target, fee: number = PLAN_DEFAULTS.fee) {
  const room = price * (1 - fee) * (1 - target) - paidActions * cost;
  return cost > 0 && ratio > 0 ? Math.max(0, Math.floor(room / (ratio * cost))) : Infinity;
}

/** Margin share for one user doing `actions` a month on a plan at `price`. */
export const marginShare = (cost: number, price: number, actions: number, fee: number = PLAN_DEFAULTS.fee) => {
  const net = price * (1 - fee);
  return net > 0 ? (net - cost * actions) / net : -Infinity;
};

export const fmtInt = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)).toLocaleString("en-US") : "no limit");
export const fmtPct = (n: number) => (Number.isFinite(n) ? `${Math.round(n * 100)}%` : "-");

/** Models with a pricing-planner page: the popular ones. */
export const plannerModels = (): TextModel[] => popularModels();
export const findPlannerModel = (slug: string) => (plannerModels().some((m) => m.slug === slug) ? findModel(slug) : undefined);

/** The worked example in the guides. */
export const EXAMPLE_MODEL = "gpt-5-mini";

/** A plan price: always two decimals. */
export const priceUsd = (n: number) => `$${n.toFixed(2)}`;
