import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CostCalculator } from "@/components/cost-calculator";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";
import { breakEven, BUILT_MONTH, BUILT_ON, calcModels, cheaperAlternatives, pairSlug, pairsFor, findModel, MESSAGE, messageCost, PLAN, perM, TEXT_MODELS, TIERS, usd } from "@/lib/models";

const MONTH = BUILT_MONTH;

export function generateStaticParams() {
  return TEXT_MODELS.map((m) => ({ model: m.slug }));
}

export async function generateMetadata({ params }: PageProps<"/llm-pricing/[model]">): Promise<Metadata> {
  const m = findModel((await params).model);
  if (!m) return {};
  const title = `${m.name} pricing: cost per message and per user (${MONTH})`;
  const description = `${m.name} costs ${perM(m.price.input)} per million input tokens and ${perM(m.price.output)} per million output tokens. That is ${usd(messageCost(m.price))} per chat message, and a $${PLAN.price} subscriber breaks even at ${breakEven(m.price).toLocaleString("en-US")} messages a month.`;
  return {
    title: `${title} · FiscaLLM`,
    description,
    alternates: { canonical: `/llm-pricing/${m.slug}` },
    openGraph: { type: "article", title, description },
  };
}

export default async function ModelPricing({ params }: PageProps<"/llm-pricing/[model]">) {
  const m = findModel((await params).model);
  if (!m) notFound();
  const p = m.price;
  const msg = messageCost(p);
  const msgCached = messageCost(p, { cachedShare: MESSAGE.cachedShare });
  const be = breakEven(p);
  const cheaper = cheaperAlternatives(m);
  const peers = TEXT_MODELS.filter((o) => o.provider !== m.provider)
    .sort((a, b) => Math.abs(messageCost(a.price) - msg) - Math.abs(messageCost(b.price) - msg))
    .slice(0, 3);
  const title = `${m.name} pricing: cost per message and per user`;

  const faq: [string, string][] = [
    [`How much does ${m.name} cost per 1M tokens?`, `${perM(p.input)} per million input tokens, ${p.cached === undefined ? "no separate cached-input price" : `${perM(p.cached)} per million cached input tokens`}, and ${perM(p.output)} per million output tokens (standard tier, list price).`],
    [`How much does one ${m.name} message cost?`, `About ${usd(msg)} for a ${MESSAGE.input.toLocaleString("en-US")}-token prompt and a ${MESSAGE.output}-token reply${p.cached !== undefined ? `, or ${usd(msgCached)} when two thirds of the prompt is read from the cache` : ""}.`],
    [`How many ${m.name} messages can a $${PLAN.price} subscriber send?`, `About ${be.toLocaleString("en-US")} a month before their AI cost uses up the ${usd(PLAN.net)} you keep after a 15% store fee. Past that, the user loses you money.`],
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: title,
        about: { "@type": "SoftwareApplication", name: m.name, applicationCategory: "Large language model API", publisher: { "@type": "Organization", name: m.providerName } },
        author: { "@type": "Organization", name: "FiscaLLM", url: "https://fiscallm.com" },
        dateModified: BUILT_ON,
        mainEntityOfPage: `https://fiscallm.com/llm-pricing/${m.slug}`,
      },
      { "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "LLM pricing", item: "https://fiscallm.com/llm-pricing" },
          { "@type": "ListItem", position: 2, name: m.name, item: `https://fiscallm.com/llm-pricing/${m.slug}` },
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
          <Link href="/llm-pricing">LLM pricing</Link> · {m.providerName}
        </p>
        <h1>
          {title} ({MONTH})
        </h1>
        <p>
          <strong>In short:</strong> {m.name} ({m.providerName}, model id <code>{m.slug}</code>) costs {perM(p.input)} per million input tokens and{" "}
          {perM(p.output)} per million output tokens. A typical chat message costs about <strong>{usd(msg)}</strong>, so a user on a ${PLAN.price}{" "}
          plan can send about <strong>{be.toLocaleString("en-US")} messages a month</strong> before they cost you more than they pay.
        </p>
        <p>
          That is an average. To see which of your own users cost more than they pay,{" "}
          <Link href="/login">track {m.name} cost per user with FiscaLLM</Link>: free and open source, one line per call. Or{" "}
          <Link href="/demo">open the demo</Link> first.
        </p>

        <h2 id="prices">Price per million tokens</h2>
        <table>
          <tbody>
            <tr><td>Input</td><td>{perM(p.input)}</td></tr>
            <tr><td>Cached input (cache read)</td><td>{p.cached === undefined ? "Not offered; billed as input" : perM(p.cached)}</td></tr>
            {p.cacheWrite !== undefined && <tr><td>Cache write (5 minutes)</td><td>{perM(p.cacheWrite)}</td></tr>}
            <tr><td>Output</td><td>{perM(p.output)}</td></tr>
            {p.long && (
              <tr>
                <td>Prompts over {p.long.threshold.toLocaleString("en-US")} tokens</td>
                <td>
                  {perM(p.long.input)} input, {perM(p.long.output)} output
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {m.next && (
          <p>
            <strong>Price change announced:</strong> from {m.next.effectiveFrom}, {perM(m.next.input)} input and {perM(m.next.output)} output per
            million tokens. That makes a message {usd(messageCost(m.next))} and the break-even {breakEven(m.next).toLocaleString("en-US")} messages a
            month.
          </p>
        )}

        <h2 id="per-user">Cost per message and per user</h2>
        <p>
          One message = {MESSAGE.input.toLocaleString("en-US")} input tokens (system prompt and recent history) and {MESSAGE.output} output tokens.
        </p>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Messages / month</th>
              <th>AI cost / month</th>
              <th>Margin on ${PLAN.price}</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((t) => {
              const cost = msg * t.messages;
              return (
                <tr key={t.label}>
                  <td>{t.label}</td>
                  <td>{t.messages.toLocaleString("en-US")}</td>
                  <td>{usd(cost)}</td>
                  <td className={PLAN.net - cost < 0 ? "text-red-600" : ""}>{usd(PLAN.net - cost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {p.cached !== undefined && (
          <p>
            With prompt caching (two thirds of each prompt read from the cache), a message costs {usd(msgCached)}, {Math.round((1 - msgCached / msg) * 100)}%
            less.
          </p>
        )}

        <h2 id="calculator">Calculate with your own numbers</h2>
      </Prose>
      <div className="mx-auto -mt-10 w-full max-w-3xl px-6">
        <CostCalculator models={calcModels()} initial={m.slug} />
      </div>
      <Prose>
        {cheaper.length > 0 && (
          <>
            <h2 id="cheaper">Cheaper {m.providerName} models</h2>
            <ul>
              {cheaper.map((c) => (
                <li key={c.slug}>
                  <Link href={`/llm-pricing/${c.slug}`}>{c.name}</Link>: {usd(messageCost(c.price))} per message, break-even{" "}
                  {breakEven(c.price).toLocaleString("en-US")} messages
                </li>
              ))}
            </ul>
            <p>
              Switching only your heaviest users to a cheaper model often fixes margin without touching everyone else&apos;s experience.
            </p>
          </>
        )}
        <h2 id="similar">Similar price from other providers</h2>
        <ul>
          {peers.map((c) => (
            <li key={c.slug}>
              <Link href={`/llm-pricing/${c.slug}`}>{c.name}</Link> ({c.providerName}): {usd(messageCost(c.price))} per message
            </li>
          ))}
        </ul>

        {pairsFor(m.slug).length > 0 && (
          <>
            <h2 id="compare">Compare {m.name} with</h2>
            <ul>
              {pairsFor(m.slug).map(([x, y]) => {
                const other = x.slug === m.slug ? y : x;
                return (
                  <li key={other.slug}>
                    <Link href={`/llm-pricing/compare/${pairSlug(x.slug, y.slug)}`}>
                      {m.name} vs {other.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <h2 id="track">Track {m.name} cost per user</h2>
        <p>
          Averages hide the users who cost you most. <Link href="/">FiscaLLM</Link> reads token counts from each {m.providerName} response, prices
          them with the rates above (including cache reads and long prompts), and puts each user&apos;s AI cost next to what they paid through
          RevenueCat, Stripe or a CSV. Free and open source, with alerts and optional per-user caps.
        </p>
        <pre>
          <code>{m.provider === "openai"
            ? `meter.trackOpenAI(res, { userId, feature: "chat" });`
            : m.provider === "anthropic"
              ? `meter.trackAnthropic(res, { userId, feature: "chat" });`
              : `meter.trackGemini(res, { userId, feature: "chat" });`}</code>
        </pre>
        <p>
          <Link href="/demo">See the demo dashboard</Link> or read the{" "}
          {m.provider === "openai" ? (
            <Link href="/guides/track-openai-cost-per-user">OpenAI cost per user guide</Link>
          ) : m.provider === "anthropic" ? (
            <Link href="/guides/track-anthropic-claude-cost-per-user">Claude cost per user guide</Link>
          ) : (
            <Link href="/docs">docs</Link>
          )}
          .
        </p>

        <h2 id="faq">Questions</h2>
        {faq.map(([q, a]) => (
          <div key={q}>
            <h3>{q}</h3>
            <p>{a}</p>
          </div>
        ))}
        <p className="text-xs">
          List prices from {m.providerName}&apos;s pricing page, standard tier; batch, priority and regional pricing differ. Check the provider for the
          latest. <a href="https://github.com/magna56/fiscallm/blob/main/ACCURACY.md">How these prices are audited</a>.
        </p>
      </Prose>
      <SiteFooter />
    </div>
  );
}
