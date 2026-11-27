import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";
import { findModel, usd } from "@/lib/models";
import { actionCost, EXAMPLE_MODEL, fmtInt, fmtPct, marginShare, paidLimit } from "@/lib/plan";

const TITLE = "Why unlimited AI plans lose money on heavy users, and the limit that fixes it";
const PATH = "/guides/unlimited-ai-plan-heavy-users";
const DESCRIPTION =
  "A flat AI subscription is priced on the average user and broken by the heaviest ones. How to find the usage where a plan starts losing money, and set a fair-use limit that protects your margin.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  keywords: ["unlimited AI plan", "AI power users losing money", "AI fair use limit", "AI app heavy users cost", "flat rate AI subscription margin"],
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const m = findModel(EXAMPLE_MODEL)!;
const cost = actionCost(m.price);
const USERS = [100, 300, 1500, 3000, 10000];

const FAQ: [string, string][] = [
  [
    "Can I still advertise unlimited?",
    "Only with a fair-use limit written in the terms, and enforced. Users rarely mind a high limit they never reach; they mind being cut off without warning. Show the remaining amount as they get close.",
  ],
  [
    "What happens when a paying user hits the limit?",
    "Good options: switch to a cheaper model for the rest of the month, offer a higher plan, or sell a top-up. Avoid silently failing requests.",
  ],
  [
    "How do I find my heavy users?",
    "Add up AI cost per user each month and sort. Compare it with what each user paid. FiscaLLM shows this list for free from RevenueCat, Stripe or a CSV.",
  ],
];

export default function Guide() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} faq={FAQ}>
      <p>
        <strong>In short:</strong> AI cost grows with every message, but a flat plan earns the same from everyone. A $9.99 plan on {m.name} keeps a
        70% AI margin up to {fmtInt(paidLimit(cost, 9.99))} actions a month and stops covering its AI cost at {fmtInt(paidLimit(cost, 9.99, 0))}. Set
        a fair-use limit near the first number. Find yours with the <Link href="/pricing-planner">free pricing planner</Link>.
      </p>

      <h2 id="shape">Usage is not average</h2>
      <p>
        In most apps a small share of users does most of the activity. When each action has a token cost, those users can cost many times what they
        pay, while the average still looks healthy. The average hides them; a per-user view shows them.
      </p>

      <h2 id="example">A $9.99 plan on {m.name}</h2>
      <table>
        <thead>
          <tr>
            <th>Actions / month</th>
            <th>AI cost</th>
            <th>Margin after a 15% fee</th>
          </tr>
        </thead>
        <tbody>
          {USERS.map((a) => (
            <tr key={a}>
              <td>{a.toLocaleString("en-US")}</td>
              <td>{usd(cost * a)}</td>
              <td>{fmtPct(marginShare(cost, 9.99, a))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>On a frontier model the same table turns negative far sooner: see any model on the <Link href="/llm-pricing">LLM pricing page</Link>.</p>

      <h2 id="limit">The limit that protects the margin</h2>
      <p>
        Fair-use limit = price × (1 − fee) × (1 − target margin) ÷ cost per action. It caps the worst case without touching typical users, who sit
        far below it. Check it on the backend before each AI call: <Link href="/guides/ai-usage-limits-by-plan">how to limit AI usage per plan</Link>.
      </p>
    </GuideShell>
  );
}
