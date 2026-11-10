import { currentPrices, estimateCost, findListed, isTextModel, type ListedPrice, type ModelPrice, PRICES_CHECKED, type Rates } from "@fiscallm/shared";
import { Hono } from "hono";

// The price table as a public, read-only JSON API. No key: anyone (and any
// AI agent) may read list prices and estimate a call's cost.

const SITE = "https://fiscallm.com";

const rates = (r: Rates) => ({
  inputPerMtok: r.input,
  outputPerMtok: r.output,
  ...(r.cached === undefined ? {} : { cachedInputPerMtok: r.cached }),
  ...(r.cacheWrite === undefined ? {} : { cacheWritePerMtok: r.cacheWrite }),
});

export function publicPrice({ price, next }: ListedPrice) {
  return {
    id: price.model,
    provider: price.provider,
    ...rates(price),
    ...(price.long ? { longContext: { overTokens: price.long.threshold, ...rates(price.long) } } : {}),
    ...(price.units ? { unitPrices: price.units } : {}),
    ...(next ? { next: { effectiveFrom: next.effectiveFrom, ...rates(next) } } : {}),
    ...(isTextModel(price) ? { url: `${SITE}/llm-pricing/${price.model}` } : {}),
  };
}

export function listPrices(filter: { provider?: string; q?: string } = {}) {
  const provider = filter.provider?.trim().toLowerCase();
  const q = filter.q?.trim().toLowerCase();
  return currentPrices()
    .filter(({ price }: { price: ModelPrice }) => (!provider || price.provider === provider) && (!q || price.model.includes(q)))
    .sort((a, b) => a.price.provider.localeCompare(b.price.provider) || a.price.model.localeCompare(b.price.model))
    .map(publicPrice);
}

export const PRICE_META = {
  currency: "USD",
  unit: "per 1,000,000 tokens (unitPrices are per image, second, minute or character)",
  tier: "list price, standard tier",
  checked: PRICES_CHECKED,
  source: `${SITE}/llm-pricing`,
  audit: "https://github.com/magna56/fiscallm/blob/main/ACCURACY.md",
  license: "MIT",
};

const count = (v: string | undefined, missing = 0) => {
  const n = v?.trim() ? Number(v) : missing;
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), 1e12) : undefined;
};

export function pricesRoute() {
  const route = new Hono();
  route.use("*", async (c, next) => {
    await next();
    c.header("access-control-allow-origin", "*");
    c.header("cache-control", "public, max-age=3600");
  });

  route.get("/prices", (c) => {
    const models = listPrices({ provider: c.req.query("provider"), q: c.req.query("q") });
    return c.json({ ...PRICE_META, count: models.length, models });
  });

  route.get("/prices/:model{.+}", (c) => {
    const listed = findListed(c.req.param("model"));
    if (!listed) return c.json({ error: "unknown model", hint: `list them at ${SITE}/api/v1/prices` }, 404);
    return c.json({ ...PRICE_META, model: publicPrice(listed) });
  });

  route.get("/estimate", (c) => {
    const model = c.req.query("model");
    const input = count(c.req.query("input"));
    const output = count(c.req.query("output"));
    const cached = count(c.req.query("cached"));
    const cacheWrite = count(c.req.query("cache_write"));
    const calls = count(c.req.query("calls"), 1);
    // No token count at all is a misspelled parameter, not a $0 call.
    const none = !c.req.query("input")?.trim() && !c.req.query("output")?.trim();
    if (none || !model || input === undefined || output === undefined || cached === undefined || cacheWrite === undefined || calls === undefined) {
      return c.json({ error: "send ?model=<id>&input=<prompt tokens>&output=<reply tokens>, optionally &cached=, &cache_write= and &calls=" }, 400);
    }
    const e = estimateCost({ model, inputTokens: input, outputTokens: output, cachedTokens: cached, cacheWriteTokens: cacheWrite, calls });
    if (!e) return c.json({ error: "unknown model", hint: `list them at ${SITE}/api/v1/prices` }, 404);
    return c.json({ ...e, inputTokens: input, outputTokens: output, cachedTokens: cached, cacheWriteTokens: cacheWrite, currency: "USD", checked: PRICES_CHECKED });
  });

  return route;
}
