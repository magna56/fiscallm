import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";
import { findModel, usd } from "@/lib/models";
import { actionCost, EXAMPLE_MODEL, fmtInt, fmtPct, marginShare, paidLimit, priceUsd } from "@/lib/plan";

const TITLE = "Should an AI app offer an annual plan? Discount, margin and refund risk";
const PATH = "/guides/ai-app-annual-plan";
const DESCRIPTION =
  "Annual plans bring cash up front, but your AI cost arrives every month. How big a discount an AI app can afford, what a refund costs, and why the monthly AI limit must stay.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  keywords: ["AI app annual plan", "annual vs monthly pricing AI app", "annual subscription discount AI", "AI app yearly plan margin", "AI subscription refund risk"],
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const m = findModel(EXAMPLE_MODEL)!;
const cost = actionCost(m.price);
const MONTHLY = 9.99;
const DISCOUNT = 0.2;
const annual = Math.ceil(MONTHLY * 12 * (1 - DISCOUNT)) - 0.01;
const discountPct = 1 - annual / (MONTHLY * 12);
const perMonth = annual / 12;
const typical = 300;
const rows = [100, 300, 1000, 2000];
const monthlyCap = paidLimit(cost, perMonth);
const refundLoss = cost * typical * 3;

const FAQ: [string, string][] = [
  [
    "How big an annual discount can an AI app afford?",
    `It depends on the margin left, not on a rule of thumb. Compute the margin of a typical user on the annual price per month first. If a ${fmtPct(DISCOUNT)} discount still leaves your target margin at typical usage, you can afford it. Discounts of 15 to 20% are common.`,
  ],
  [
    "Should an annual plan include unlimited AI use?",
    "No. The money comes in once but the AI cost arrives every month. Keep a monthly allowance on the annual plan so one heavy user cannot spend a year of revenue in a few weeks.",
  ],
  [
    "What happens to AI cost when an annual user asks for a refund?",
    "The store or Stripe returns the money, but the AI calls already made stay paid on your OpenAI, Claude or Gemini bill. That is why a monthly limit also matters in the first weeks of an annual plan.",
  ],
];

export default function Guide() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} faq={FAQ}>
      <p>
        <strong>In short:</strong> yes, if you price the annual plan on the margin it leaves each month and keep a monthly AI limit. On {m.name}, a{" "}
        {priceUsd(MONTHLY)} monthly plan next to a {priceUsd(annual)} annual plan ({fmtPct(discountPct)} off) still earns about{" "}
        {fmtPct(marginShare(cost, perMonth, typical, 0.15))} margin at {typical} actions a month. Annual plans give you cash now and fewer cancellations,
        but they never remove the AI cost, which arrives every month. Check the numbers for your own model in the{" "}
        <Link href="/pricing-planner">free pricing planner</Link>.
      </p>

      <h2 id="why">Why annual plans are different for AI apps</h2>
      <p>
        In a normal software business an annual plan is almost pure upside: the customer pays early and costs you about the same each month. In an AI
        app the cost grows with use. A user who pays once and then uses the app every day spends your money for twelve months out of one payment.
      </p>
      <p>
        Two things follow. The discount must come out of your margin, and the monthly allowance must stay, so the plan is still safe in month nine.
      </p>

      <h2 id="discount">1. Price the annual plan on the monthly margin</h2>
      <p>
        Take the annual price and divide by 12. That is what each month earns before fees. On {m.name}, one chat action costs about {usd(cost)}. With a
        15% store fee, the table shows the AI margin for a user at four levels of usage.
      </p>
      <table>
        <thead>
          <tr>
            <th>Actions / month</th>
            <th>AI cost / month</th>
            <th>Margin on {priceUsd(MONTHLY)} monthly</th>
            <th>Margin on {priceUsd(annual)} annual</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a}>
              <td>{fmtInt(a)}</td>
              <td>{usd(cost * a)}</td>
              <td>{fmtPct(marginShare(cost, MONTHLY, a))}</td>
              <td>{fmtPct(marginShare(cost, perMonth, a))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        A margin near zero or below means the user costs about as much as the plan brings in. Pick a discount where your typical user still sits above your target, and
        decide ahead of time what you do for the users who do not.
      </p>

      <h2 id="fee">2. Remember the store fee changes</h2>
      <p>
        Apple and Google keep 15% or 30%, depending on your program and how long the subscriber has stayed. At a 30% fee the typical user above ({typical} actions a month) earns{" "}
        {fmtPct(marginShare(cost, perMonth, typical, 0.3))} on the annual price. Confirm your own rate in the store terms, then use that fee in the
        math.
      </p>

      <h2 id="limit">3. Keep a monthly limit on the annual plan</h2>
      <p>
        Do not turn a yearly payment into a yearly allowance. Split it: the monthly share of the annual price, {priceUsd(perMonth)}, supports about{" "}
        {fmtInt(monthlyCap)} actions a month at a 70% target margin. Make that the limit, reset it each month, and show users how much is left. A
        user who burns the whole year in one month is the case a flat annual plan handles worst.
      </p>
      <p>
        FiscaLLM can hold this limit for you: set a monthly AI allowance on the paid plan and ask <code>meter.check(userId)</code> before each call.
        See <Link href="/docs#plan-limits">limits by plan</Link> and the guide on{" "}
        <Link href="/guides/ai-usage-limits-by-plan">limiting AI usage per plan</Link>.
      </p>

      <h2 id="refunds">4. Count the refund risk</h2>
      <p>
        When an annual user cancels in month three and gets the money back, you lose the revenue but keep the bill. At {typical} actions a month on{" "}
        {m.name}, three months of use is about {usd(refundLoss)} of AI cost with nothing coming in. That is small for one user and real across a
        launch week. On the App Store and Google Play the store decides refunds, so the monthly limit from day one is your protection; for plans
        sold on the web through Stripe you set the refund policy yourself.
      </p>

      <h2 id="measure">5. Read the results by month, not by payment</h2>
      <p>
        An annual payment lands in one month, so a naive report shows huge profit in January and a loss every month after. Spread the revenue across the
        12 months before you judge margin, or look at a longer window. The same applies to trials: see{" "}
        <Link href="/guides/ai-app-free-trial-cost">what a free trial really costs</Link>. For RevenueCat apps the details are in{" "}
        <Link href="/guides/ai-margin-per-user-revenuecat">AI margin per user in RevenueCat</Link>.
      </p>

      <h2 id="offer">What to do</h2>
      <ol>
        <li>Work out the AI cost of one action and the typical monthly use of a paying user.</li>
        <li>Choose a discount that keeps the typical user above your target margin at the real store fee.</li>
        <li>Keep a monthly limit on the annual plan.</li>
        <li>Keep the limit active from day one, set a clear refund policy for web sales, and track cost per user.</li>
      </ol>
      <p>
        If you are still choosing between plan shapes, read <Link href="/guides/credits-vs-subscription-ai-app">credits or subscription</Link>, then
        see your own users in the <Link href="/demo">demo</Link>.
      </p>
    </GuideShell>
  );
}
