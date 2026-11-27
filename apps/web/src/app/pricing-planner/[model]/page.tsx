import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PricingPlanner } from "@/components/pricing-planner";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";
import { BUILT_MONTH, BUILT_ON, calcModels, perM, usd } from "@/lib/models";
import { actionCost, priceUsd, findPlannerModel, fmtInt, fmtPct, freeLimit, marginShare, minPrice, paidLimit, PLAN_DEFAULTS, plannerModels } from "@/lib/plan";

const ACTIONS = [30, 100, 300, 1000, 3000];
const TYPICAL = 300;

export function generateStaticParams() {
  return plannerModels().map((m) => ({ model: m.slug }));
}

function numbers(slug: string) {
  const m = findPlannerModel(slug);
  if (!m) return null;
  const cost = actionCost(m.price);
  return {
    m,
    cost,
    price: minPrice(cost, TYPICAL),
    limit999: paidLimit(cost, 9.99),
    free999: freeLimit(cost, 9.99, TYPICAL),
  };
}

export async function generateMetadata({ params }: PageProps<"/pricing-planner/[model]">): Promise<Metadata> {
  const n = numbers((await params).model);
  if (!n) return {};
  const title = `How much to charge for an AI app built on ${n.m.name} (${BUILT_MONTH})`;
  const description = `One ${n.m.name} chat action costs about ${usd(n.cost)}. For a user doing ${TYPICAL} a month, charge at least ${priceUsd(n.price)} for a 70% AI margin. A $9.99 plan stays above 70% up to ${fmtInt(n.limit999)} actions a month. Free planner, no sign-up.`;
  return {
    title: `${title} · FiscaLLM`,
    description,
    alternates: { canonical: `/pricing-planner/${n.m.slug}` },
    openGraph: { type: "article", title, description, url: `/pricing-planner/${n.m.slug}` },
  };
}

export default async function ModelPlanner({ params }: PageProps<"/pricing-planner/[model]">) {
  const n = numbers((await params).model);
  if (!n) notFound();
  const { m, cost } = n;
  const pctTarget = Math.round(PLAN_DEFAULTS.target * 100);
  const title = `How much to charge for an AI app built on ${m.name}`;
  const faq: [string, string][] = [
    [
      `How much does one ${m.name} request cost?`,
      `About ${usd(cost)} for a chat turn with a 1,500-token prompt (half of it read from cache) and a 400-token reply, at ${perM(m.price.input)} per million input tokens and ${perM(m.price.output)} per million output tokens (${BUILT_MONTH} list prices).`,
    ],
    [
      `What should I charge for a ${m.name} app?`,
      `For a typical user doing ${TYPICAL} AI actions a month, at least ${priceUsd(n.price)} a month to keep a ${pctTarget}% AI margin after a 15% store or payment fee. Charge more for what the app is worth; this is the floor.`,
    ],
    [
      `How many free ${m.name} messages can I give away?`,
      `With one $9.99 plan used ${TYPICAL} times a month and 10 free users per payer, up to ${fmtInt(n.free999)} free actions per free user a month (about ${fmtInt(n.free999 / 30)} a day) while keeping a ${pctTarget}% margin overall.`,
    ],
    [
      `Does a $9.99 plan on ${m.name} lose money on heavy users?`,
      `It stays above a ${pctTarget}% AI margin up to ${fmtInt(n.limit999)} actions a month per user, and stops covering its AI cost at ${fmtInt(paidLimit(cost, 9.99, 0))}. Set a monthly limit near the first number so no single user can cost more than the plan earns.`,
    ],
  ];
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: title,
        mainEntityOfPage: `https://fiscallm.com/pricing-planner/${m.slug}`,
        author: { "@type": "Organization", name: "FiscaLLM" },
        dateModified: BUILT_ON,
      },
      { "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  };
  const others = plannerModels().filter((o) => o.slug !== m.slug);

  return (
    <div className="flex min-h-full flex-1 flex-col overflow-x-clip">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <main className="flex flex-col">
        <Prose>
          <p className="!mb-0 text-sm text-muted">
            <Link href="/pricing-planner">Pricing planner</Link>
          </p>
          <h1>{title}</h1>
          <p>
            <strong>In short:</strong> one {m.name} chat action costs about <strong>{usd(cost)}</strong>. For a user doing {TYPICAL} a month, charge
            at least <strong>{priceUsd(n.price)}</strong> a month to keep a {pctTarget}% AI margin after store fees. A $9.99 plan keeps that margin up to{" "}
            <strong>{fmtInt(n.limit999)} actions</strong> per user a month, and with 10 free users per payer you can give each free user about{" "}
            <strong>{fmtInt(n.free999)} actions</strong> a month.
          </p>
          <h2>Price and margin by usage</h2>
          <table>
            <thead>
              <tr>
                <th>Actions / user / month</th>
                <th>AI cost</th>
                <th>Lowest price for {pctTarget}%</th>
                <th>Margin at $9.99</th>
                <th>Margin at $19.99</th>
              </tr>
            </thead>
            <tbody>
              {ACTIONS.map((a) => (
                <tr key={a}>
                  <td>{a.toLocaleString("en-US")}</td>
                  <td>{usd(cost * a)}</td>
                  <td>{priceUsd(minPrice(cost, a))}</td>
                  <td>{fmtPct(marginShare(cost, 9.99, a))}</td>
                  <td>{fmtPct(marginShare(cost, 19.99, a))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-muted">
            One action: 1,500 prompt tokens (half from cache) and 400 reply tokens at {m.providerName}&apos;s {BUILT_MONTH} list prices. Margin is
            after a 15% App Store, Google Play or Stripe fee, before hosting. Change any of it below.
          </p>
        </Prose>
        <section className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Plan your own pricing on {m.name}</h2>
          <div className="mt-4">
            <PricingPlanner models={calcModels()} initial={m.slug} />
          </div>
        </section>
        <Prose>
          <p>
            Token prices for {m.name}: <Link href={`/llm-pricing/${m.slug}`}>{m.name} pricing and cost per message</Link>. Once you launch, FiscaLLM
            enforces <Link href="/guides/ai-usage-limits-by-plan">a limit per plan</Link> and shows the real AI cost of every user against what they
            pay. Free and open source.
          </p>
          <h2>Questions</h2>
          {faq.map(([q, a]) => (
            <div key={q}>
              <h3>{q}</h3>
              <p>{a}</p>
            </div>
          ))}
          <h2>Other models</h2>
          <p>
            {others.map((o, i) => (
              <span key={o.slug}>
                {i > 0 && " · "}
                <Link href={`/pricing-planner/${o.slug}`}>{o.name}</Link>
              </span>
            ))}
          </p>
        </Prose>
      </main>
      <SiteFooter />
    </div>
  );
}
