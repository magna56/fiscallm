import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";
import { BUILT_MONTH, messageCost, popularModels, TIERS, usd } from "@/lib/models";
import { PLAN_DEFAULTS } from "@/lib/plan";

const TITLE = "How much does it cost to run an AI chatbot app? Per user, per month";
const PATH = "/guides/cost-to-run-ai-chatbot-app";
const DESCRIPTION = `What one AI chat user costs you a month on OpenAI, Claude and Gemini models, for light, typical and heavy users, at ${BUILT_MONTH} list prices. With the formula and what to do with the number.`;

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  keywords: ["cost to run AI chatbot", "ChatGPT wrapper cost per user", "AI app running cost", "OpenAI API cost per user per month", "how much does an AI app cost to run"],
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const cost = (m: ReturnType<typeof popularModels>[number]) => messageCost(m.price, { cachedShare: PLAN_DEFAULTS.cachedShare });
const rows = popularModels().sort((a, b) => cost(a) - cost(b));
const cheapest = rows[0]!;
const dearest = rows[rows.length - 1]!;

const FAQ: [string, string][] = [
  [
    "What is the biggest cost of running an AI chatbot app?",
    "For most apps it is the model API, not hosting. Every message pays for the whole prompt again: system prompt, chat history and any documents. Long conversations get more expensive with every turn unless you trim or cache the history.",
  ],
  [
    "Does hosting cost matter?",
    "Usually much less. A small backend on Vercel, Cloudflare or a single server costs a few dollars to tens of dollars a month in total, while AI cost grows with every user and every message.",
  ],
  [
    "How do I find my real cost per user?",
    "Read the token counts from each API response, price them, and add them up per user ID. FiscaLLM does this with one line after each AI call and puts the result next to what each user paid.",
  ],
];

export default function Guide() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} faq={FAQ}>
      <p>
        <strong>In short:</strong> a typical chat user sending 300 messages a month costs from {usd(cost(cheapest) * 300)} on {cheapest.name} to{" "}
        {usd(cost(dearest) * 300)} on {dearest.name}, at {BUILT_MONTH} list prices. Model choice moves the cost by orders of magnitude; usage per user
        moves it by ten to a hundred times. Price your plans on both: the <Link href="/pricing-planner">free pricing planner</Link> does it in a minute.
      </p>

      <h2 id="formula">The formula</h2>
      <p>
        Cost per user per month = messages per month × (prompt tokens × input price + reply tokens × output price), with cached prompt tokens at the
        cached price. The table assumes a 1,500-token prompt (system prompt plus history, half of it read from cache) and a 400-token reply.
      </p>

      <h2 id="table">Monthly AI cost per user, by model</h2>
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>Per message</th>
            {TIERS.map((t) => (
              <th key={t.label}>
                {t.label} ({t.messages.toLocaleString("en-US")})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.slug}>
              <td>
                <Link href={`/pricing-planner/${m.slug}`}>{m.name}</Link>
              </td>
              <td>{usd(cost(m))}</td>
              {TIERS.map((t) => (
                <td key={t.label}>{usd(cost(m) * t.messages)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <h2 id="heavy">The heavy user is the number that matters</h2>
      <p>
        Your average user decides whether the business works; your heaviest users decide whether a plan loses money. A user sending 3,000 messages a
        month on a mid-priced model can cost more than a $9.99 subscription brings in after store fees.{" "}
        <Link href="/guides/unlimited-ai-plan-heavy-users">Why unlimited plans lose money on heavy users</Link>.
      </p>

      <h2 id="next">What to do with the number</h2>
      <ul>
        <li>
          Set prices from it: <Link href="/guides/how-to-price-an-ai-app">how to price an AI app</Link>.
        </li>
        <li>
          Size the free tier from it: <Link href="/guides/ai-free-tier-limits">how many free messages you can afford</Link>.
        </li>
        <li>
          Lower it: <Link href="/guides/cut-llm-cost-per-user">ways to cut LLM cost per user</Link>.
        </li>
        <li>
          Measure it on real users after launch: <Link href="/demo">see the FiscaLLM demo</Link> (free and open source).
        </li>
      </ul>
    </GuideShell>
  );
}
