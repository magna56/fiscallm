import { MODEL_PRICES, type ModelPrice } from "@fiscallm/shared";
import type { CalcModel } from "@/components/cost-calculator";

// Text models from FiscaLLM's price table, for the public pricing pages.
// Media models (images, audio, video) are priced per unit and left out.

export interface TextModel {
  slug: string;
  name: string;
  provider: "openai" | "anthropic" | "google";
  providerName: string;
  price: ModelPrice;
  /** A later listed price, e.g. an announced increase. */
  next?: ModelPrice;
}

const PROVIDER_NAMES = { openai: "OpenAI", anthropic: "Anthropic", google: "Google" } as const;
// Dated snapshots ("gpt-4-0613", "gpt-4o-2024-05-13") would be near-duplicate pages.
const MEDIA = /image|tts|transcribe|whisper|realtime|audio|live|veo|davinci|babbage|instruct|-\d{4}$|-\d{4}-\d{2}-\d{2}$/;

/** "gpt-4o-mini" → "GPT-4o mini", "claude-sonnet-4-5" → "Claude Sonnet 4.5", "gemini-2.5-flash" → "Gemini 2.5 Flash". */
export function displayName(model: string): string {
  if (model.startsWith("gpt-")) {
    const [, version, ...rest] = model.split("-");
    return `GPT-${version}${rest.length ? " " + rest.join(" ") : ""}`;
  }
  if (/^o\d/.test(model)) return model;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (model.startsWith("claude-")) {
    const parts = model.split("-").slice(1);
    const nums = parts.filter((p) => /^\d+$/.test(p));
    const words = parts.filter((p) => !/^\d+$/.test(p));
    return `Claude ${words.map(cap).join(" ")} ${nums.join(".")}`.trim();
  }
  if (model.startsWith("gemini-")) return model.split("-").map((p) => (/^\d/.test(p) ? p : cap(p))).join(" ");
  return model;
}

// Fixed when the site is built, so pages prerender with stable dates.
export const BUILT_ON = new Date().toISOString().slice(0, 10);
export const BUILT_MONTH = new Date().toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

function build(today = BUILT_ON): TextModel[] {
  const byModel = new Map<string, ModelPrice[]>();
  for (const p of MODEL_PRICES) {
    if (!["openai", "anthropic", "google"].includes(p.provider) || p.units || MEDIA.test(p.model) || p.input <= 0) continue;
    byModel.set(p.model, [...(byModel.get(p.model) ?? []), p]);
  }
  const out: TextModel[] = [];
  for (const [model, rows] of byModel) {
    const sorted = rows.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    const current = sorted.filter((r) => r.effectiveFrom <= today).at(-1);
    if (!current) continue;
    const provider = current.provider as TextModel["provider"];
    out.push({
      slug: model,
      name: displayName(model),
      provider,
      providerName: PROVIDER_NAMES[provider],
      price: current,
      next: sorted.find((r) => r.effectiveFrom > today),
    });
  }
  return out;
}

export const TEXT_MODELS: TextModel[] = build();
export const findModel = (slug: string) => TEXT_MODELS.find((m) => m.slug === slug);

// A typical chat turn: system prompt and history in, a reply out.
export const MESSAGE = { input: 1500, output: 400, cachedShare: 2 / 3 };
export const TIERS = [
  { label: "Light user", messages: 30 },
  { label: "Typical user", messages: 300 },
  { label: "Heavy user", messages: 3000 },
] as const;
/** A $9.99 monthly plan after a 15% store fee. */
export const PLAN = { price: 9.99, net: 9.99 * 0.85 };

/** USD for one message, optionally with part of the prompt read from cache. */
export function messageCost(p: ModelPrice, opts: { input?: number; output?: number; cachedShare?: number } = {}) {
  const input = opts.input ?? MESSAGE.input;
  const output = opts.output ?? MESSAGE.output;
  const cached = Math.round(input * (opts.cachedShare ?? 0));
  const cachedRate = p.cached ?? p.input;
  return ((input - cached) * p.input + cached * cachedRate + output * p.output) / 1e6;
}

export function usd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toPrecision(2)}`;
  if (n < 1) return `$${n.toFixed(n < 0.1 ? 4 : 3)}`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const perM = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 3 })}`;

/** Messages a month before the AI cost uses up the plan's net revenue. */
export const breakEven = (p: ModelPrice) => Math.floor(PLAN.net / messageCost(p));

/** Cheaper models from the same provider, closest in price first. */
export function cheaperAlternatives(m: TextModel, n = 3): TextModel[] {
  const cost = messageCost(m.price);
  return TEXT_MODELS.filter((o) => o.provider === m.provider && o.slug !== m.slug && messageCost(o.price) < cost)
    .sort((a, b) => messageCost(b.price) - messageCost(a.price))
    .slice(0, n);
}

/** All text models for the calculator, grouped by provider, cheapest first. */
export const calcModels = (): CalcModel[] =>
  [...TEXT_MODELS]
    .sort((a, b) => a.providerName.localeCompare(b.providerName) || messageCost(a.price) - messageCost(b.price))
    .map((m) => ({ slug: m.slug, name: m.name, providerName: m.providerName, input: m.price.input, cached: m.price.cached ?? m.price.input, output: m.price.output }));

// Models people compare most; every pair among them gets a comparison page.
const POPULAR = [
  "gpt-6-sol", "gpt-6-luna", "gpt-5.5", "gpt-5-mini", "gpt-5-nano", "gpt-4.1", "gpt-4o", "gpt-4o-mini", "o3",
  "claude-opus-5-5", "claude-sonnet-5-5", "claude-sonnet-4-5", "claude-haiku-5-5", "claude-haiku-4-5",
  "gemini-4-argon", "gemini-3.8-flash", "gemini-2.5-pro", "gemini-2.5-flash",
];

const PAIR_SEP = "-vs-";
export const pairSlug = (a: string, b: string) => [a, b].sort().join(PAIR_SEP);

/** Every comparison page, each pair once (slugs in alphabetical order). */
export function modelPairs(): [TextModel, TextModel][] {
  const list = POPULAR.map(findModel).filter((m): m is TextModel => Boolean(m));
  const out: [TextModel, TextModel][] = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const [a, b] = [list[i]!, list[j]!].sort((x, y) => x.slug.localeCompare(y.slug));
      out.push([a!, b!]);
    }
  return out;
}

export function parsePair(slug: string): [TextModel, TextModel] | null {
  const pair = modelPairs().find(([a, b]) => pairSlug(a.slug, b.slug) === slug);
  return pair ?? null;
}

/** Pairs that include this model, for links from its page. */
export const pairsFor = (slug: string) => modelPairs().filter(([a, b]) => a.slug === slug || b.slug === slug);
