import type { Metadata } from "next";
import Link from "next/link";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = {
  title: "Guides · FiscaLLM",
  description: "Practical guides on limiting AI usage by plan, tracking AI cost per user and protecting your margins.",
  alternates: { canonical: "/guides" },
};

const GUIDES = [
  {
    href: "/guides/how-to-price-an-ai-app",
    title: "How to price an AI app: a formula and a worked example",
    body: "Cost per AI action, usage per user, store fees and a target margin give the lowest price; a monthly limit protects it.",
  },
  {
    href: "/guides/ai-free-tier-limits",
    title: "How many free AI messages can you afford? Sizing a free tier",
    body: "The free allowance your paying users can carry, by free users per payer, with a worked example.",
  },
  {
    href: "/guides/unlimited-ai-plan-heavy-users",
    title: "Why unlimited AI plans lose money on heavy users, and the limit that fixes it",
    body: "Where a flat plan stops earning its target margin, and the fair-use limit that caps the worst case.",
  },
  {
    href: "/guides/ai-usage-limits-by-plan",
    title: "How to limit AI usage per subscription plan (free, trial and paid)",
    body: "What to count, when to reset, how your backend knows the plan, and the remaining number that opens the paywall.",
  },
  {
    href: "/guides/ai-cost-per-customer-stripe",
    title: "How to track AI cost per customer against Stripe revenue",
    body: "Tag users in Stripe metadata, use net revenue after fees and tax, handle trials and refunds, and backfill past invoices.",
  },
  {
    href: "/guides/ai-margin-from-revenue-csv",
    title: "How to calculate AI margin per user from a revenue CSV",
    body: "Paddle, Lemon Squeezy, Stripe exports or a spreadsheet: the columns you need and how to join them with LLM cost.",
  },
  {
    href: "/guides/ai-margin-per-user-revenuecat",
    title: "How to calculate AI margin per user in a RevenueCat app",
    body: "Use the right user ID, net revenue after store fees and tax, and handle trials, annual plans and refunds.",
  },
  {
    href: "/guides/track-anthropic-claude-cost-per-user",
    title: "How to track Anthropic Claude cost per user",
    body: "Claude's usage fields, cache reads and writes priced correctly, streaming, and comparing cost with revenue.",
  },
  {
    href: "/guides/track-openai-cost-per-user",
    title: "How to track OpenAI cost per user",
    body: "Read the usage object, price it, store it per user, and compare it with what each user pays.",
  },
];

export default function GuidesPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <Prose>
        <h1>Guides</h1>
        <p>Practical write-ups on AI limits by plan, AI cost per user and protecting your margins.</p>
        <ul className="!list-none !pl-0">
          {GUIDES.map((g) => (
            <li key={g.href} className="!my-4 rounded-2xl border border-black/5 bg-white p-5">
              <Link href={g.href} className="!no-underline text-lg font-semibold text-foreground">
                {g.title}
              </Link>
              <p className="!my-1">{g.body}</p>
            </li>
          ))}
        </ul>
      </Prose>
      <SiteFooter />
    </div>
  );
}
