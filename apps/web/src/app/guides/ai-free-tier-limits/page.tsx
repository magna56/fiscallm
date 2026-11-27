import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";
import { findModel, usd } from "@/lib/models";
import { actionCost, EXAMPLE_MODEL, fmtInt, freeLimit } from "@/lib/plan";

const TITLE = "How many free AI messages can you afford? Sizing a free tier";
const PATH = "/guides/ai-free-tier-limits";
const DESCRIPTION =
  "Free users of an AI app cost real money. How to work out the largest free tier your paying users can carry, with the formula, a worked example and a free calculator.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  keywords: ["AI app free tier", "how many free AI messages", "free tier limit AI", "freemium AI app cost", "AI free trial cost"],
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const m = findModel(EXAMPLE_MODEL)!;
const cost = actionCost(m.price);
const RATIOS = [5, 10, 20, 50];

const FAQ: [string, string][] = [
  [
    "How many free users does each paying user carry?",
    "Consumer apps commonly convert 2 to 5% of active users, which means 20 to 50 free users per payer. Hard-paywall and B2B apps see fewer. Use your own number once you have one; start with 10 to 20.",
  ],
  [
    "Is a free trial cheaper than a free tier?",
    "Usually. A trial ends, so its cost is bounded per user; a free tier costs money every month for as long as the user stays. Many AI apps now use a short trial or a small daily allowance instead of a generous permanent free plan.",
  ],
  [
    "Daily or monthly free limits?",
    "Daily limits (for example 5 a day) spread usage and bring people back; monthly limits are simpler to explain. For cost, what matters is the monthly total: 5 a day is up to 150 a month.",
  ],
];

export default function Guide() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} faq={FAQ}>
      <p>
        <strong>In short:</strong> free actions per free user per month = (what a payer leaves after fees, AI cost and your target margin) ÷ (free
        users per payer × cost per action). With a $9.99 plan used 300 times a month on {m.name}, a 70% target and 10 free users per payer, each free
        user can have about {fmtInt(freeLimit(cost, 9.99, 300, 10))} actions a month. Try your numbers in the{" "}
        <Link href="/pricing-planner">free pricing planner</Link>.
      </p>

      <h2 id="why">Why free tiers hurt AI apps more</h2>
      <p>
        In ordinary software a free user costs almost nothing. In an AI app every message has a token cost, and free users are most of your users. A
        common surprise after launch is that the biggest AI bill comes from people who never pay.
      </p>

      <h2 id="formula">The formula</h2>
      <ol>
        <li>What a payer leaves for free users: price × (1 − store fee) × (1 − target margin) − the payer&apos;s own AI cost.</li>
        <li>Spread it over the free users that payer carries.</li>
        <li>Divide by the cost of one action to get a number of actions.</li>
      </ol>

      <h2 id="example">Worked example on {m.name}</h2>
      <p>
        One action costs about {usd(cost)}. A $9.99 plan after a 15% fee keeps $8.49; a 70% target leaves $2.55 for AI. A payer using 300 actions
        spends {usd(cost * 300)} of that. The rest is shared with free users:
      </p>
      <table>
        <thead>
          <tr>
            <th>Free users per payer</th>
            <th>Free actions / user / month</th>
            <th>About per day</th>
          </tr>
        </thead>
        <tbody>
          {RATIOS.map((r) => {
            const f = freeLimit(cost, 9.99, 300, r);
            return (
              <tr key={r}>
                <td>{r}</td>
                <td>{fmtInt(f)}</td>
                <td>{fmtInt(f / 30)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        On a more expensive model the same tier can be ten times smaller: compare models on the <Link href="/llm-pricing">LLM pricing page</Link>.
      </p>

      <h2 id="enforce">Enforce it on the backend</h2>
      <p>
        A free limit only protects you if the server checks it before each AI call. <Link href="/guides/ai-usage-limits-by-plan">How to limit AI
        usage per plan</Link> covers counting, resets and the paywall. FiscaLLM does it with one <code>check()</code> call, free and open source.
      </p>
    </GuideShell>
  );
}
