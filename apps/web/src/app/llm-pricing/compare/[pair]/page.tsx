import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CostCalculator } from "@/components/cost-calculator";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";
import {
  breakEven,
  BUILT_MONTH,
  BUILT_ON,
  calcModels,
  MESSAGE,
  messageCost,
  modelPairs,
  pairSlug,
  pairsFor,
  parsePair,
  PLAN,
  perM,
  TIERS,
  type TextModel,
  usd,
} from "@/lib/models";

export function generateStaticParams() {
  return modelPairs().map(([a, b]) => ({ pair: pairSlug(a.slug, b.slug) }));
}

/** "3.2× cheaper" or "about the same". */
function ratio(cheap: number, dear: number) {
  const r = dear / cheap;
  return r < 1.1 ? "about the same price" : `${r >= 10 ? Math.round(r) : r.toFixed(1)}× cheaper`;
}

function summary(a: TextModel, b: TextModel) {
  const [ca, cb] = [messageCost(a.price), messageCost(b.price)];
  const [cheap, dear] = ca <= cb ? [a, b] : [b, a];
  return { cheap, dear, text: `${cheap.name} is ${ratio(Math.min(ca, cb), Math.max(ca, cb))} than ${dear.name} per chat message` };
}

export async function generateMetadata({ params }: PageProps<"/llm-pricing/compare/[pair]">): Promise<Metadata> {
  const pair = parsePair((await params).pair);
  if (!pair) return {};
  const [a, b] = pair;
  const s = summary(a, b);
  const title = `${a.name} vs ${b.name} pricing: cost per message and per user (${BUILT_MONTH})`;
  const description = `${s.text}: ${usd(messageCost(a.price))} vs ${usd(messageCost(b.price))}. Price per million tokens, cost per user per month, caching and break-even on a $${PLAN.price} plan, side by side.`;
  return {
    title: `${title} · FiscaLLM`,
    description,
    alternates: { canonical: `/llm-pricing/compare/${pairSlug(a.slug, b.slug)}` },
    openGraph: { type: "article", title, description },
  };
}

export default async function PairPage({ params }: PageProps<"/llm-pricing/compare/[pair]">) {
  const slug = (await params).pair;
  const pair = parsePair(slug);
  if (!pair) {
    // "b-vs-a" goes to the one canonical "a-vs-b" page.
    const [x, y] = slug.split("-vs-");
    if (x && y && parsePair(pairSlug(x, y))) permanentRedirect(`/llm-pricing/compare/${pairSlug(x, y)}`);
    notFound();
  }
  const [a, b] = pair;
  const s = summary(a, b);
  const both = [a, b];
  const cached = (m: TextModel) => messageCost(m.price, { cachedShare: MESSAGE.cachedShare });
  const title = `${a.name} vs ${b.name} pricing`;
  const related = [...pairsFor(a.slug), ...pairsFor(b.slug)]
    .filter(([x, y]) => pairSlug(x.slug, y.slug) !== pairSlug(a.slug, b.slug))
    .slice(0, 8);

  const faq: [string, string][] = [
    [`Is ${a.name} or ${b.name} cheaper?`, `${s.text}: ${usd(messageCost(s.cheap.price))} vs ${usd(messageCost(s.dear.price))} for a ${MESSAGE.input.toLocaleString("en-US")}-token prompt and a ${MESSAGE.output}-token reply, at list prices.`],
    [`How many messages can a $${PLAN.price} subscriber send on each?`, `About ${breakEven(a.price).toLocaleString("en-US")} a month on ${a.name} and ${breakEven(b.price).toLocaleString("en-US")} on ${b.name}, before AI cost uses up what you keep after a 15% store fee.`],
    [`Can I use both?`, `Yes. A common pattern is the cheaper model for most traffic and the stronger one for hard requests or paying users. Track cost per user to see whether the mix pays off.`],
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: title,
        author: { "@type": "Organization", name: "FiscaLLM", url: "https://fiscallm.com" },
        dateModified: BUILT_ON,
        mainEntityOfPage: `https://fiscallm.com/llm-pricing/compare/${pairSlug(a.slug, b.slug)}`,
      },
      { "@type": "FAQPage", mainEntity: faq.map(([q, ans]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: ans } })) },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "LLM pricing", item: "https://fiscallm.com/llm-pricing" },
          { "@type": "ListItem", position: 2, name: title, item: `https://fiscallm.com/llm-pricing/compare/${pairSlug(a.slug, b.slug)}` },
        ],
      },
    ],
  };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Prose>
        <p className="!mb-0 text-sm text-muted">
          <Link href="/llm-pricing">LLM pricing</Link> · Compare
        </p>
        <h1>
          {title} ({BUILT_MONTH})
        </h1>
        <p>
          <strong>In short:</strong> {s.text}: <strong>{usd(messageCost(s.cheap.price))}</strong> vs {usd(messageCost(s.dear.price))} for a typical chat
          turn ({MESSAGE.input.toLocaleString("en-US")} tokens in, {MESSAGE.output} out). On a ${PLAN.price} plan, a user can send about{" "}
          {breakEven(s.cheap.price).toLocaleString("en-US")} messages a month on {s.cheap.name} before they cost more than they pay, versus{" "}
          {breakEven(s.dear.price).toLocaleString("en-US")} on {s.dear.name}.
        </p>

        <h2 id="prices">Price per million tokens</h2>
        <table>
          <thead>
            <tr>
              <th></th>
              {both.map((m) => (
                <th key={m.slug}>
                  <Link href={`/llm-pricing/${m.slug}`}>{m.name}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr><td>Provider</td>{both.map((m) => <td key={m.slug}>{m.providerName}</td>)}</tr>
            <tr><td>Input</td>{both.map((m) => <td key={m.slug}>{perM(m.price.input)}</td>)}</tr>
            <tr><td>Cached input</td>{both.map((m) => <td key={m.slug}>{m.price.cached === undefined ? "–" : perM(m.price.cached)}</td>)}</tr>
            <tr><td>Output</td>{both.map((m) => <td key={m.slug}>{perM(m.price.output)}</td>)}</tr>
            <tr>
              <td>Long prompts</td>
              {both.map((m) => (
                <td key={m.slug}>{m.price.long ? `over ${m.price.long.threshold.toLocaleString("en-US")} tokens: ${perM(m.price.long.input)} in, ${perM(m.price.long.output)} out` : "same rate"}</td>
              ))}
            </tr>
          </tbody>
        </table>

        <h2 id="per-user">Cost per message and per user</h2>
        <table>
          <thead>
            <tr>
              <th></th>
              {both.map((m) => <th key={m.slug}>{m.name}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr><td>Per message</td>{both.map((m) => <td key={m.slug}>{usd(messageCost(m.price))}</td>)}</tr>
            <tr><td>Per message, prompt 2/3 cached</td>{both.map((m) => <td key={m.slug}>{usd(cached(m))}</td>)}</tr>
            {TIERS.map((t) => (
              <tr key={t.label}>
                <td>
                  {t.label} ({t.messages.toLocaleString("en-US")} msgs/mo)
                </td>
                {both.map((m) => {
                  const cost = messageCost(m.price) * t.messages;
                  return (
                    <td key={m.slug} className={PLAN.net - cost < 0 ? "text-red-600" : ""}>
                      {usd(cost)}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr><td>Break-even on ${PLAN.price}</td>{both.map((m) => <td key={m.slug}>{breakEven(m.price).toLocaleString("en-US")} msgs/mo</td>)}</tr>
          </tbody>
        </table>
        <p className="text-sm">Red: the user costs more in AI than the {usd(PLAN.net)} you keep from a ${PLAN.price} plan after a 15% store fee.</p>

        <h2 id="choose">Which to use</h2>
        <p>
          Price is only half of it: pick the cheapest model that gives answers your users accept. Many apps route most traffic to the cheaper model
          and send only hard requests, or only paying users, to the stronger one. Whatever the mix, the number that decides your margin is cost{" "}
          <em>per user</em>, because a few heavy users usually drive most of the bill.
        </p>

        <h2 id="calculator">Try your own numbers</h2>
      </Prose>
      <div className="mx-auto -mt-10 w-full max-w-3xl px-6">
        <CostCalculator models={calcModels()} initial={s.cheap.slug} />
      </div>
      <Prose>
        <h2 id="track">Track the real cost of each user</h2>
        <p>
          <Link href="/">FiscaLLM</Link> prices every {a.providerName}
          {a.provider !== b.provider ? ` and ${b.providerName}` : ""} call with these rates, per user, and sets it next to what that user paid through
          RevenueCat, Stripe or a CSV. You see which users and which model lose you money. Free and open source.{" "}
          <Link href="/demo">See the demo</Link>.
        </p>

        {related.length > 0 && (
          <>
            <h2 id="related">More comparisons</h2>
            <ul>
              {related.map(([x, y]) => (
                <li key={pairSlug(x.slug, y.slug)}>
                  <Link href={`/llm-pricing/compare/${pairSlug(x.slug, y.slug)}`}>
                    {x.name} vs {y.name}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 id="faq">Questions</h2>
        {faq.map(([q, ans]) => (
          <div key={q}>
            <h3>{q}</h3>
            <p>{ans}</p>
          </div>
        ))}
        <p className="text-xs">List prices, standard tier. Batch, priority and regional pricing differ; check each provider for the latest.</p>
      </Prose>
      <SiteFooter />
    </div>
  );
}
