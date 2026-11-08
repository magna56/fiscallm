import type { Metadata } from "next";
import Link from "next/link";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";
import { BUILT_MONTH, BUILT_ON, MESSAGE, messageCost, PLAN, popularModels, TEXT_MODELS, TIERS, type TextModel, usd } from "@/lib/models";

// A monthly summary of the price table, written to be quoted: every number is
// computed from the same prices the pricing pages and the product use.

const TITLE = `LLM pricing report, ${BUILT_MONTH}: what an AI chat subscriber costs`;
const URL = "https://fiscallm.com/llm-pricing/report";

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};
const times = (r: number) => `${r >= 10 ? Math.round(r).toLocaleString("en-US") : r.toFixed(1)}×`;

function findings() {
  const byCost = [...TEXT_MODELS].sort((a, b) => messageCost(a.price) - messageCost(b.price));
  const cheapest = byCost[0]!;
  const priciest = byCost.at(-1)!;
  const heavy = TIERS.find((t) => t.label === "Heavy user")!;
  const typical = TIERS.find((t) => t.label === "Typical user")!;
  const losing = (msgs: number) => TEXT_MODELS.filter((m) => messageCost(m.price) * msgs > PLAN.net).length;
  const cachedModels = TEXT_MODELS.filter((m) => m.price.cached !== undefined && m.price.cached < m.price.input);
  const cacheSaving = median(cachedModels.map((m) => 1 - messageCost(m.price, { cachedShare: MESSAGE.cachedShare }) / messageCost(m.price)));
  const outputRatio = median(TEXT_MODELS.map((m) => m.price.output / m.price.input));
  const changes = TEXT_MODELS.filter((m) => m.next);
  return { byCost, cheapest, priciest, heavy, typical, losing, cachedModels, cacheSaving, outputRatio, changes };
}

export function generateMetadata(): Metadata {
  const f = findings();
  const description = `${TEXT_MODELS.length} OpenAI, Anthropic and Google models at list prices: a chat message costs from ${usd(messageCost(f.cheapest.price))} to ${usd(messageCost(f.priciest.price))}, and a heavy user on a $${PLAN.price} plan loses you money on ${f.losing(f.heavy.messages)} of them.`;
  return {
    title: `${TITLE} · FiscaLLM`,
    description,
    alternates: { canonical: "/llm-pricing/report" },
    openGraph: { type: "article", title: TITLE, description },
  };
}

function providerRow(name: string, models: TextModel[]) {
  const costs = models.map((m) => messageCost(m.price)).sort((a, b) => a - b);
  return { name, count: models.length, low: costs[0]!, mid: median(costs), high: costs.at(-1)! };
}

/** Horizontal bars: monthly AI cost of a heavy user per model, with the plan's net revenue marked. */
function HeavyUserChart({ models, messages }: { models: TextModel[]; messages: number }) {
  const rows = models.map((m) => ({ m, cost: messageCost(m.price) * messages })).sort((a, b) => a.cost - b.cost);
  const max = Math.max(...rows.map((r) => r.cost), PLAN.net) * 1.05;
  const pct = (v: number) => `${(v / max) * 100}%`;
  return (
    <figure className="my-6">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 border-l border-dashed border-foreground/40" style={{ left: `calc(9.5rem + (100% - 9.5rem - 4.5rem) * ${PLAN.net / max})` }} aria-hidden />
        <ul className="!list-none !pl-0 text-xs">
          {rows.map(({ m, cost }) => (
            <li key={m.slug} className="!my-0 flex items-center gap-2 py-[3px]" title={`${m.name}: ${usd(cost)} a month for ${messages.toLocaleString("en-US")} messages`}>
              <Link href={`/llm-pricing/${m.slug}`} className="w-[9rem] shrink-0 truncate !text-foreground/80 !no-underline hover:!underline">
                {m.name}
              </Link>
              <span className="relative h-3 flex-1">
                <span className="absolute inset-y-0 left-0 rounded-r bg-accent" style={{ width: pct(cost), minWidth: 2 }} />
              </span>
              <span className="w-[4rem] shrink-0 text-right tabular-nums text-foreground/80">{usd(cost)}</span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-2 text-xs text-muted">
        Monthly AI cost of one heavy user ({messages.toLocaleString("en-US")} messages) on popular models, list prices. Dashed line: the {usd(PLAN.net)} you keep
        from a ${PLAN.price} plan after a 15% store fee. Bars past it lose money on that user.
      </figcaption>
    </figure>
  );
}

export default function Report() {
  const f = findings();
  const providers = (["openai", "anthropic", "google"] as const).map((p) =>
    providerRow(TEXT_MODELS.find((m) => m.provider === p)!.providerName, TEXT_MODELS.filter((m) => m.provider === p)),
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: TITLE,
        author: { "@type": "Organization", name: "FiscaLLM", url: "https://fiscallm.com" },
        publisher: { "@id": "https://fiscallm.com/#org" },
        dateModified: BUILT_ON,
        mainEntityOfPage: URL,
      },
      {
        "@type": "Dataset",
        name: "LLM API prices per million tokens",
        url: "https://fiscallm.com/llm-pricing",
        license: "https://opensource.org/licenses/MIT",
        creator: { "@type": "Organization", name: "FiscaLLM", url: "https://fiscallm.com" },
        dateModified: BUILT_ON,
        isAccessibleForFree: true,
      },
    ],
  };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Prose>
        <p className="!mb-0 text-sm text-muted">
          <Link href="/llm-pricing">LLM pricing</Link> · Report
        </p>
        <h1>{TITLE}</h1>
        <p>
          Token prices do not tell you whether a subscription pays. This report turns the list prices of {TEXT_MODELS.length} OpenAI, Anthropic and Google
          text models into the numbers that do: what one chat message costs ({MESSAGE.input.toLocaleString("en-US")} tokens in, {MESSAGE.output} out) and
          what one user costs a month on a ${PLAN.price} plan. Updated {BUILT_ON}.
        </p>

        <h2 id="findings">Key findings</h2>
        <ul>
          <li>
            <strong>
              A message costs from {usd(messageCost(f.cheapest.price))} to {usd(messageCost(f.priciest.price))}.
            </strong>{" "}
            {f.cheapest.name} is the cheapest and {f.priciest.name} the most expensive, a {times(messageCost(f.priciest.price) / messageCost(f.cheapest.price))}{" "}
            spread for the same conversation.
          </li>
          <li>
            <strong>
              A heavy user loses you money on {f.losing(f.heavy.messages)} of {TEXT_MODELS.length} models.
            </strong>{" "}
            At {f.heavy.messages.toLocaleString("en-US")} messages a month, their AI cost passes the {usd(PLAN.net)} you keep from a ${PLAN.price} plan. A typical
            user ({f.typical.messages} messages) does on {f.losing(f.typical.messages)}.
          </li>
          <li>
            <strong>Output is the expensive half.</strong> The median model charges {times(f.outputRatio)} more per output token than per input token, so long
            replies cost more than long prompts.
          </li>
          <li>
            <strong>Caching cuts the median message by {Math.round(f.cacheSaving * 100)}%.</strong> That is for the {f.cachedModels.length} models with a
            cached-input price, when two thirds of each prompt (system prompt and history) is read from the cache.
          </li>
          {f.changes.length > 0 && (
            <li>
              <strong>Announced price changes:</strong>{" "}
              {f.changes.map((m, i) => (
                <span key={m.slug}>
                  {i > 0 && "; "}
                  <Link href={`/llm-pricing/${m.slug}`}>{m.name}</Link> from {m.next!.effectiveFrom} ({usd(messageCost(m.price))} → {usd(messageCost(m.next!))} a
                  message)
                </span>
              ))}
              .
            </li>
          )}
        </ul>

        <h2 id="heavy-user">What a heavy user costs</h2>
        <HeavyUserChart models={popularModels()} messages={f.heavy.messages} />
        <p>
          Most AI apps have a few users like this, and a flat plan charges them the same as everyone else. Choosing a cheaper model for them, or capping
          them, decides whether the plan makes money.
        </p>

        <h2 id="providers">By provider</h2>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Models</th>
              <th>Cheapest message</th>
              <th>Median</th>
              <th>Most expensive</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.name}>
                <td>{p.name}</td>
                <td>{p.count}</td>
                <td>{usd(p.low)}</td>
                <td>{usd(p.mid)}</td>
                <td>{usd(p.high)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 id="cheapest">Ten cheapest models per message</h2>
        <ol>
          {f.byCost.slice(0, 10).map((m) => (
            <li key={m.slug}>
              <Link href={`/llm-pricing/${m.slug}`}>{m.name}</Link> ({m.providerName}): {usd(messageCost(m.price))}
            </li>
          ))}
        </ol>
        <p>
          All {TEXT_MODELS.length} models, with a calculator: <Link href="/llm-pricing">LLM API pricing compared</Link>.
        </p>

        <h2 id="method">Method and sources</h2>
        <p>
          Standard-tier list prices for prompts under each model&apos;s long-context threshold, audited against OpenAI, Anthropic and Google pricing pages (
          <a href="https://github.com/magna56/fiscallm/blob/main/ACCURACY.md">ACCURACY.md</a>). A message is {MESSAGE.input.toLocaleString("en-US")} input and{" "}
          {MESSAGE.output} output tokens. Users: {TIERS.map((t) => `${t.label.toLowerCase()} ${t.messages.toLocaleString("en-US")} messages a month`).join(", ")}.
          Revenue: a ${PLAN.price} monthly plan less a 15% app store fee. Batch, priority and regional prices are not included. The data is MIT licensed.
        </p>
        <p className="text-sm">
          To cite: FiscaLLM, &quot;{TITLE}&quot;, {URL}
        </p>

        <h2 id="your-users">Your own users</h2>
        <p>
          These are averages. <Link href="/">FiscaLLM</Link> prices every AI call your app makes, per user, and sets it next to what that user paid through
          RevenueCat, Stripe or a CSV, so you see which users and plans lose money. Free and open source. <Link href="/demo">See the demo</Link> or{" "}
          <Link href="/login">start free</Link>.
        </p>
      </Prose>
      <SiteFooter />
    </div>
  );
}
