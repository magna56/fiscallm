import type { Metadata } from "next";
import Link from "next/link";
import { CostCalculator } from "@/components/cost-calculator";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";
import { breakEven, BUILT_MONTH, BUILT_ON, calcModels, modelPairs, pairSlug, MESSAGE, messageCost, PLAN, perM, TEXT_MODELS, usd } from "@/lib/models";

const MONTH = BUILT_MONTH;
const TITLE = `LLM API pricing compared: cost per message and per user (${MONTH})`;
const DESCRIPTION = `Price per million tokens for ${TEXT_MODELS.length} OpenAI, Anthropic Claude and Google Gemini models, what one chat message costs, and how many messages a $9.99 subscriber can send before you lose money. With a free calculator.`;

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: "/llm-pricing" },
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION },
};

const FAQ: [string, string][] = [
  [
    "What is the cheapest LLM API per message?",
    (() => {
      const [a, b, c] = [...TEXT_MODELS].sort((x, y) => messageCost(x.price) - messageCost(y.price));
      return `At list prices, for a ${MESSAGE.input.toLocaleString("en-US")}-token prompt and a ${MESSAGE.output}-token reply: ${a!.name} (${usd(messageCost(a!.price))}), ${b!.name} (${usd(messageCost(b!.price))}) and ${c!.name} (${usd(messageCost(c!.price))}).`;
    })(),
  ],
  [
    "How do I calculate LLM cost per user?",
    "Multiply each call's input, cached and output tokens by the model's price per million tokens, add up the calls for each user, and compare the total with what that user paid you after store fees and tax.",
  ],
  [
    "Why do output tokens cost more than input tokens?",
    "Generating each output token takes a full pass through the model, while input tokens are processed in parallel. Most providers charge 4 to 8 times more for output.",
  ],
  [
    "Does prompt caching reduce cost?",
    "Yes. Tokens read from the cache are billed at a fraction of the input price, often 10%. A chat app that resends the same system prompt and history can cut input cost by more than half.",
  ],
];

export default function LlmPricing() {
  const sorted = [...TEXT_MODELS].sort((a, b) => a.providerName.localeCompare(b.providerName) || messageCost(a.price) - messageCost(b.price));
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Dataset",
        name: "LLM API prices per million tokens",
        description: DESCRIPTION,
        url: "https://fiscallm.com/llm-pricing",
        license: "https://opensource.org/licenses/MIT",
        creator: { "@type": "Organization", name: "FiscaLLM", url: "https://fiscallm.com" },
        dateModified: BUILT_ON,
        isAccessibleForFree: true,
      },
      {
        "@type": "WebApplication",
        name: "AI cost per user calculator",
        url: "https://fiscallm.com/llm-pricing#calculator",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      { "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Prose>
        <h1>{TITLE}</h1>
        <p>
          List prices for {TEXT_MODELS.length} text models from OpenAI, Anthropic and Google, turned into numbers you can price a subscription with:
          what one chat message costs ({MESSAGE.input.toLocaleString("en-US")} tokens in, {MESSAGE.output} out), and how many messages a user on a $
          {PLAN.price} plan can send each month before their AI cost uses up what you keep after a 15% store fee. Prices are the ones FiscaLLM uses to
          cost real usage, audited against each provider&apos;s pricing page. Summary: <Link href="/llm-pricing/report">{MONTH} pricing report</Link>.
        </p>

        <h2 id="calculator">AI cost per user calculator</h2>
      </Prose>
      <div className="mx-auto -mt-10 w-full max-w-3xl px-6">
        <CostCalculator models={calcModels()} initial="gpt-5-mini" />
      </div>
      <Prose>
        <h2 id="table">Price per million tokens and per message</h2>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>Input</th>
                <th>Cached</th>
                <th>Output</th>
                <th>Per message</th>
                <th>Break-even / mo</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.slug}>
                  <td>
                    <Link href={`/llm-pricing/${m.slug}`}>{m.name}</Link> <span className="text-xs text-muted">{m.providerName}</span>
                  </td>
                  <td>{perM(m.price.input)}</td>
                  <td>{m.price.cached === undefined ? "–" : perM(m.price.cached)}</td>
                  <td>{perM(m.price.output)}</td>
                  <td>{usd(messageCost(m.price))}</td>
                  <td>{breakEven(m.price).toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm">
          USD per million tokens, standard tier, prompts under the long-context threshold. &quot;Break-even&quot; is messages per month at which a $
          {PLAN.price} subscriber costs you everything you keep. Sources and audit:{" "}
          <a href="https://github.com/magna56/fiscallm/blob/main/ACCURACY.md">ACCURACY.md</a>.
        </p>

        <h2 id="compare">Head-to-head comparisons</h2>
        <ul className="!list-none !pl-0 grid gap-x-6 sm:grid-cols-2">
          {modelPairs().map(([a, b]) => (
            <li key={pairSlug(a.slug, b.slug)}>
              <Link href={`/llm-pricing/compare/${pairSlug(a.slug, b.slug)}`}>
                {a.name} vs {b.name}
              </Link>
            </li>
          ))}
        </ul>

        <h2 id="averages">Why averages are not enough</h2>
        <p>
          A model that looks cheap per message can still lose money on your heaviest users. In most AI apps a few percent of users run up most of
          the bill, and a flat plan charges them the same as everyone else. To price safely you need cost <em>per user</em>, next to what each user
          actually paid.
        </p>
        <p>
          That is what <Link href="/">FiscaLLM</Link> does: one line after each AI call reports token counts (never prompts), RevenueCat, Stripe or a
          CSV reports revenue, and you see margin per user, plan and free trial, with alerts and optional caps. Free and open source.{" "}
          <Link href="/demo">See the demo dashboard</Link>.
        </p>

        <h2 id="faq">Questions</h2>
        {FAQ.map(([q, a]) => (
          <div key={q}>
            <h3>{q}</h3>
            <p>{a}</p>
          </div>
        ))}
      </Prose>
      <SiteFooter />
    </div>
  );
}
