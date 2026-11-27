import type { Metadata } from "next";
import Link from "next/link";
import { PricingPlanner } from "@/components/pricing-planner";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";
import { calcModels, TEXT_MODELS } from "@/lib/models";
import { plannerModels } from "@/lib/plan";

const TITLE = "AI app pricing planner: what to charge, and how big a free tier you can afford";
const DESCRIPTION = `Free planner for apps and websites that call AI. Pick a model from ${TEXT_MODELS.length}, enter your plans, and see the margin on each plan, what a heavy user costs you, a monthly AI limit per plan and the largest free tier you can afford. No sign-up.`;

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  keywords: ["AI app pricing calculator", "how much to charge for an AI app", "AI free tier limit", "AI subscription pricing", "LLM cost per user", "AI app margin calculator"],
  alternates: { canonical: "/pricing-planner" },
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: "/pricing-planner" },
};

const FAQ: [string, string][] = [
  [
    "How much should I charge for an AI app?",
    "Start from what one AI action costs (input, cached and output tokens at the model's price), multiply by what a typical user does in a month, and divide by one minus your target margin and one minus the store or payment fee. The planner does this for each plan and rounds to a .99 price.",
  ],
  [
    "How big a free tier can I afford?",
    "It depends on how many free users each payer carries. The planner takes what your paid plans earn, subtracts their AI cost and the margin you want to keep, and spreads the rest over your free users: that is the most each free user can use in a month.",
  ],
  [
    "Why does a heavy user matter if the average is fine?",
    "A flat plan is priced on the average, but AI cost grows with every message. Someone who uses five times the typical amount can cost more than they pay. A monthly limit per plan caps that loss; the planner gives the limit that still keeps your target margin.",
  ],
  [
    "Is anything I type sent to FiscaLLM?",
    "No. The planner runs in your browser. A shared link holds the plan in the part of the URL after #, which browsers do not send to the server.",
  ],
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "AI app pricing planner",
      url: "https://fiscallm.com/pricing-planner",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    { "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ],
};

export default function PricingPlannerPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col overflow-x-clip">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <SiteHeader />
      <main className="flex flex-col">
        <section className="mx-auto w-full max-w-4xl px-4 pt-14 sm:px-6 sm:pt-20">
          <p className="shimmer text-sm font-medium">Free, no sign-up</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Price your AI app before your users price it for you.</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Enter the model and your plans. See the margin on each plan, what your heaviest users cost, the monthly AI limit per plan and the
            largest free tier you can afford.
          </p>
          <div className="mt-8">
            <PricingPlanner models={calcModels()} initial="gpt-5-mini" />
          </div>
        </section>
        <Prose>
          <h2>How the numbers work</h2>
          <p>
            <strong>Cost per action</strong> is the prompt tokens not read from cache at the input price, cached tokens at the cached price, and the
            reply at the output price. <strong>You keep</strong> is the plan price after the App Store, Google Play or Stripe fee. The{" "}
            <strong>margin</strong> is what you keep minus AI cost, as a share of what you keep. Hosting and other costs are not included.
          </p>
          <p>
            Prices are list prices from FiscaLLM&apos;s price table, the same one behind the <Link href="/llm-pricing">LLM pricing comparison</Link>.
          </p>
          <h2>After launch</h2>
          <p>
            Plans are guesses until real users arrive. FiscaLLM is free and open source: one line after each AI call, revenue from RevenueCat, Stripe
            or a CSV, and it enforces these limits with one <code>check()</code> before each call and shows the real margin of every user.{" "}
            <Link href="/guides/ai-usage-limits-by-plan">How limits by plan work</Link> · <Link href="/demo">See the demo</Link>.
          </p>
          <h2>By model</h2>
          <p>
            {plannerModels().map((m, i) => (
              <span key={m.slug}>
                {i > 0 && " · "}
                <Link href={`/pricing-planner/${m.slug}`}>{m.name}</Link>
              </span>
            ))}
          </p>
          <h2>Guides</h2>
          <ul>
            <li><Link href="/guides/how-to-price-an-ai-app">How to price an AI app</Link></li>
            <li><Link href="/guides/ai-free-tier-limits">How many free AI messages you can afford</Link></li>
            <li><Link href="/guides/unlimited-ai-plan-heavy-users">Why unlimited AI plans lose money on heavy users</Link></li>
          </ul>
          <h2>Questions</h2>
          {FAQ.map(([q, a]) => (
            <div key={q}>
              <h3>{q}</h3>
              <p>{a}</p>
            </div>
          ))}
        </Prose>
      </main>
      <SiteFooter />
    </div>
  );
}
