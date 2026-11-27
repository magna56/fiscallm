import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";
import { findModel, usd } from "@/lib/models";
import { actionCost, priceUsd, EXAMPLE_MODEL, fmtInt, minPrice, paidLimit } from "@/lib/plan";

const TITLE = "How to price an AI app: a formula and a worked example";
const PATH = "/guides/how-to-price-an-ai-app";
const DESCRIPTION =
  "How much to charge for an app or website that calls OpenAI, Claude or Gemini: work out the cost of one AI action, multiply by usage, add store fees and a target margin, then cap heavy users. With a free planner.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  keywords: ["how to price an AI app", "AI app pricing", "how much to charge for AI app", "AI SaaS pricing", "AI subscription pricing", "LLM app pricing"],
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const m = findModel(EXAMPLE_MODEL)!;
const cost = actionCost(m.price);
const p300 = minPrice(cost, 300);
const p1000 = minPrice(cost, 1000);
const lim = paidLimit(cost, 9.99);

const FAQ: [string, string][] = [
  [
    "What is a good gross margin for an AI app?",
    "Software usually runs at 75 to 90% gross margin. AI apps run lower because every request costs money. Aim for at least 60 to 70% on AI cost alone, so hosting, support and refunds still fit.",
  ],
  [
    "Should an AI app charge a flat subscription or per use?",
    "Most consumer and indie apps do best with a flat subscription that includes an allowance (for example 500 messages a month), plus a limit or top-up for heavy users. Pure pay-per-use is clearer for costs but harder to sell to people who want a predictable bill.",
  ],
  [
    "How do I stop heavy users from losing me money?",
    "Give each plan a monthly AI allowance, check it on the backend before every AI call, and offer an upgrade or a cheaper model when it runs out. The limit that keeps your margin is the plan's net price times one minus your target margin, divided by the cost of one action.",
  ],
  [
    "Do I need to include App Store fees?",
    "Yes. Apple and Google keep 15% (small businesses and renewals after a year) or 30%, and Stripe about 3%. Price on what you keep, not on the list price.",
  ],
];

export default function Guide() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} faq={FAQ}>
      <p>
        <strong>In short:</strong> lowest price = AI cost per action × actions per user per month ÷ (1 − target margin) ÷ (1 − store fee). On{" "}
        {m.name}, one chat action costs about {usd(cost)}, so a user doing 300 a month needs at least {priceUsd(p300)} a month for a 70% AI margin, and a
        user doing 1,000 needs {priceUsd(p1000)}. Then set a monthly limit so your heaviest users cannot break the plan. The{" "}
        <Link href="/pricing-planner">free pricing planner</Link> does all of this for any model.
      </p>

      <h2 id="cost">1. Work out what one AI action costs</h2>
      <p>
        An action is whatever your app does with AI once: a chat reply, a summary, a photo edit. Its cost is the prompt tokens times the input price,
        plus the reply tokens times the output price, plus cached tokens at the (much lower) cached price. Read real token counts from the
        provider&apos;s response in development; guesses are usually low because of system prompts and chat history.
      </p>
      <p>
        Example: 1,500 prompt tokens (half read from cache) and a 400-token reply on {m.name} cost about {usd(cost)}. Prices per model are on the{" "}
        <Link href="/llm-pricing">LLM pricing page</Link>.
      </p>

      <h2 id="usage">2. Estimate usage per user, including the heavy ones</h2>
      <p>
        Guess a typical month for a paying user, then assume your heaviest 5% use five to ten times that. Flat plans are priced on the typical user
        and broken by the heavy one. If you have no data, 300 actions a month is a reasonable start for a chat-style app, 30 to 100 for a tool used a
        few times a week.
      </p>

      <h2 id="price">3. Set the price from what you keep</h2>
      <p>
        Divide the monthly AI cost by one minus your target margin, then by one minus the store or payment fee. That is the floor, not the price:
        charge for what the app is worth, but never below the floor.
      </p>
      <table>
        <thead>
          <tr>
            <th>Actions / month</th>
            <th>AI cost on {m.name}</th>
            <th>Lowest price for 70%</th>
          </tr>
        </thead>
        <tbody>
          {[100, 300, 1000, 3000].map((a) => (
            <tr key={a}>
              <td>{a.toLocaleString("en-US")}</td>
              <td>{usd(cost * a)}</td>
              <td>{priceUsd(minPrice(cost, a))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 id="limit">4. Cap each plan so one user cannot break it</h2>
      <p>
        The most one user can do on a plan before it earns less than your target is: price × (1 − fee) × (1 − target) ÷ cost per action. For a $9.99
        plan on {m.name} that is {fmtInt(lim)} actions a month. Make that the plan&apos;s fair-use limit, show users how much is left, and offer an
        upgrade when it runs out. <Link href="/guides/ai-usage-limits-by-plan">How to limit AI usage per plan</Link>.
      </p>

      <h2 id="free">5. Size the free tier last</h2>
      <p>
        Free users are paid for by paying users. Whatever margin is left above your target is what you can give away.{" "}
        <Link href="/guides/ai-free-tier-limits">How many free AI messages you can afford</Link>.
      </p>

      <h2 id="after">6. Check it against real users after launch</h2>
      <p>
        Real usage never matches the plan. Track the AI cost of every user next to what they paid (RevenueCat, Stripe or a CSV) and adjust prices and
        limits on facts. FiscaLLM does this for free: <Link href="/demo">see the demo</Link>.
      </p>
    </GuideShell>
  );
}
