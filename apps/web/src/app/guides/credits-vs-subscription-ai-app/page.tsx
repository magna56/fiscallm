import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";

const TITLE = "Credits or subscription for an AI app? How to choose";
const PATH = "/guides/credits-vs-subscription-ai-app";
const DESCRIPTION =
  "Flat subscription, subscription with an allowance, credits or pay as you go: what each does to your AI margin, what users prefer, and what a small team can build and run.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  keywords: ["credits vs subscription AI app", "AI app pricing model", "credit based pricing AI", "usage based pricing AI app", "AI app monetization"],
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const FAQ: [string, string][] = [
  [
    "What pricing model do most AI apps use?",
    "Most consumer and indie AI apps sell a subscription that includes an allowance (messages, images or minutes) and either block, slow down or upsell when it runs out. Pure credits are more common for image, video and voice apps where each job has a clear, large cost.",
  ],
  [
    "Are credits hard to build?",
    "Harder than they look. A balance needs reservations before each job, refunds when a job fails, expiry rules for free, monthly and purchased credits, and handling of store refunds. A subscription with a monthly allowance needs only a counter that resets.",
  ],
  [
    "Can I sell credits in an iOS app?",
    "Yes, as consumable in-app purchases through the App Store (RevenueCat handles them), with Apple's fee. Selling the same credits on the web through Stripe avoids the store fee but must follow the store's rules on linking out.",
  ],
];

export default function Guide() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} faq={FAQ}>
      <p>
        <strong>In short:</strong> for most new AI apps, sell a subscription with an AI allowance per plan, and add credits or top-ups only when
        users ask to buy more. It is the simplest to build, the easiest for users to understand, and it caps what any one user can cost you. Credits
        fit apps where each job is large and uneven, like video or long documents.
      </p>

      <h2 id="options">The four models</h2>
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>Your AI margin</th>
            <th>For users</th>
            <th>To build</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Flat, unlimited subscription</td>
            <td>At risk: heavy users can cost more than they pay</td>
            <td>Simplest</td>
            <td>Easy</td>
          </tr>
          <tr>
            <td>Subscription with an allowance per plan</td>
            <td>Protected by the limit</td>
            <td>Simple: &quot;500 messages a month&quot;</td>
            <td>Easy: a counter per user and period</td>
          </tr>
          <tr>
            <td>Credits (prepaid packs)</td>
            <td>Protected if priced per job</td>
            <td>Clear per job, but people dislike watching a meter</td>
            <td>Hard: balances, holds, refunds, expiry</td>
          </tr>
          <tr>
            <td>Pay as you go</td>
            <td>Protected</td>
            <td>Unpredictable bill; best for developers and businesses</td>
            <td>Hard: metering and invoicing</td>
          </tr>
        </tbody>
      </table>

      <h2 id="allowance">Why the allowance usually wins first</h2>
      <p>
        It keeps the familiar subscription, which app stores, RevenueCat and Stripe already handle, and adds one number per plan. The limit protects
        your margin from the heaviest users, and the moment someone reaches it is the best upgrade prompt you have. Work out the numbers with the{" "}
        <Link href="/pricing-planner">pricing planner</Link>, then enforce them:{" "}
        <Link href="/guides/ai-usage-limits-by-plan">how to limit AI usage per plan</Link>.
      </p>

      <h2 id="credits">When credits are worth it</h2>
      <ul>
        <li>Jobs vary a lot in cost (a 10-second clip versus a 2-minute video).</li>
        <li>Users come back rarely, so a monthly plan feels wasteful to them.</li>
        <li>You already have a subscription and people ask to buy extra.</li>
      </ul>
      <p>
        If you go this way, reserve credits before the job starts and settle after, so parallel requests cannot overspend. FiscaLLM&apos;s Jobs feature
        shows the AI cost of pay-per-job work, including jobs that were refunded or never completed, so you can price packs on real numbers.
      </p>

      <h2 id="measure">Whatever you pick, measure margin per user</h2>
      <p>
        Every model is a guess until real users arrive. Compare what each user cost you in AI with what they paid (from RevenueCat, Stripe or a CSV)
        and adjust. FiscaLLM does this free and open source: <Link href="/demo">see the demo</Link>.
      </p>
    </GuideShell>
  );
}
