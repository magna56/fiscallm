import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";
import { findModel, usd } from "@/lib/models";
import { actionCost, EXAMPLE_MODEL } from "@/lib/plan";

const TITLE = "What a free trial of an AI app really costs, and how to cap it";
const PATH = "/guides/ai-app-free-trial-cost";
const DESCRIPTION =
  "Trial users who never convert still run up AI cost. How to work out the AI cost per trial and per converted customer, and how to cap trial usage without hurting conversion.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  keywords: ["AI app free trial cost", "free trial AI usage limit", "trial conversion AI cost", "RevenueCat trial AI cost", "cost per trial"],
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const m = findModel(EXAMPLE_MODEL)!;
const cost = actionCost(m.price);
const perTrial = cost * 150;

const FAQ: [string, string][] = [
  [
    "Should trial users get the full paid allowance?",
    "Give them enough to reach the moment the app proves its value, not the full monthly allowance in a few days. A daily trial limit (for example 20 a day for 7 days) spreads usage and caps the worst case.",
  ],
  [
    "How do I know the AI cost of my trials?",
    "Group users by trial start date, add up their AI cost during the trial, and divide by the number who converted. FiscaLLM shows this per trial cohort from RevenueCat or Stripe trial events.",
  ],
];

export default function Guide() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} faq={FAQ}>
      <p>
        <strong>In short:</strong> the cost that matters is AI cost per converted customer: total AI cost of everyone who started a trial, divided by
        those who paid. If 150 trial actions on {m.name} cost {usd(perTrial)} and 1 in 10 trials converts, each customer costs{" "}
        {usd(perTrial * 10)} in trial AI before paying anything. Cap trial usage per day and compare that number with a customer&apos;s first-month
        revenue.
      </p>

      <h2 id="math">The math</h2>
      <ol>
        <li>AI cost per trial = trial actions × cost per action.</li>
        <li>AI cost per converted customer = AI cost per trial ÷ conversion rate.</li>
        <li>Payback = that cost ÷ first month&apos;s net revenue (after store fees).</li>
      </ol>
      <p>
        Trials on expensive models or with heavy features (image generation, long documents) can cost more than the first payment. Check yours in the{" "}
        <Link href="/pricing-planner">pricing planner</Link> by treating trial users as free users.
      </p>

      <h2 id="cap">How to cap trials without hurting conversion</h2>
      <ul>
        <li>Use a daily limit rather than a total, so a trial cannot be used up on day one.</li>
        <li>Show the remaining count, and offer to start the subscription early when it runs out.</li>
        <li>Use a cheaper model for trial users on features where quality differences are small.</li>
        <li>Watch for repeat trials from the same person; stores and Stripe allow one trial per account, not per device.</li>
      </ul>
      <p>
        Set the trial plan its own allowance: <Link href="/guides/ai-usage-limits-by-plan">how to limit AI usage per plan</Link>.
      </p>

      <h2 id="measure">Measure trials by cohort</h2>
      <p>
        FiscaLLM reads trial starts and conversions from RevenueCat or Stripe and shows each trial cohort&apos;s AI cost, conversion and AI cost per
        converted customer, free and open source. <Link href="/demo">See the demo</Link> ·{" "}
        <Link href="/guides/ai-margin-per-user-revenuecat">RevenueCat margin guide</Link>.
      </p>
    </GuideShell>
  );
}
