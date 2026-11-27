import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";
import { findModel, usd } from "@/lib/models";
import { actionCost, priceUsd, EXAMPLE_MODEL, fmtInt, minPrice, paidLimit } from "@/lib/plan";

const TITLE = "Should your AI app let users bring their own API key?";
const PATH = "/guides/byok-vs-managed-ai-keys";
const DESCRIPTION =
  "Bring your own key (BYOK) or your own keys on a plan? What each costs you, who carries the risk, and the usage level where a managed plan stops making sense. With the math for a real model.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  keywords: ["bring your own key AI app", "BYOK AI pricing", "BYOK vs managed API keys", "let users use their own OpenAI key", "AI app pricing own API key"],
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const m = findModel(EXAMPLE_MODEL)!;
const cost = actionCost(m.price);
const p100 = minPrice(cost, 100);
const p1000 = minPrice(cost, 1000);
const lim = paidLimit(cost, 9.99);

const FAQ: [string, string][] = [
  [
    "Is BYOK cheaper for me?",
    "Yes for AI cost: you pay nothing to the model provider for those users, so there is no margin to protect on AI. You still pay for hosting, support and payment fees, and you give up the markup you could earn on usage.",
  ],
  [
    "Who is a BYOK app good for?",
    "Developers and power users who already have a provider account, use the app a lot, and want to choose the model. Casual users usually do not have a key and will not create one.",
  ],
  [
    "Can I offer both a managed plan and BYOK?",
    "Yes, and many apps do. Sell a managed plan with a monthly allowance to most people, and a cheaper plan or a free tier for users who bring their own key. Only the managed plan carries your AI cost, so only that plan needs a usage limit.",
  ],
  [
    "Is it safe to ask users for their API key?",
    "Treat it like a password. Store it encrypted, never log it, never send it to your analytics, and make it easy to delete. If you can, keep the key on the user's device and call the provider from there.",
  ],
];

export default function Guide() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} faq={FAQ}>
      <p>
        <strong>In short:</strong> let users bring their own key if your users are developers or heavy users, and use your own keys on a paid plan if
        your users are casual. With your keys, you carry the AI cost and must price and limit for it. On {m.name}, one chat action costs about{" "}
        {usd(cost)}, so a user doing 1,000 a month needs a plan of at least {priceUsd(p1000)} for a 70% AI margin. With their keys, that cost is
        theirs. Many apps offer both. Try your own numbers in the <Link href="/pricing-planner">free pricing planner</Link>.
      </p>

      <h2 id="what">What the two options mean</h2>
      <p>
        <strong>Managed keys:</strong> your backend calls OpenAI, Claude or Gemini with your key. You bill the user and pay the provider. Your margin is
        the difference.
      </p>
      <p>
        <strong>Bring your own key (BYOK):</strong> the user pastes their own provider key. The provider bills them directly. You charge only for the
        app, or nothing at all.
      </p>

      <h2 id="cost">What managed keys cost you</h2>
      <p>
        The AI cost is your cost on every action. Using the same math as <Link href="/guides/how-to-price-an-ai-app">How to price an AI app</Link>:
        on {m.name}, one action is about {usd(cost)}. The lowest plan price that keeps a 70% AI margin after a 15% store fee depends on how much a
        user does:
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
      <p>
        A light user doing 100 actions needs {priceUsd(p100)}. A heavy user costs thirty times more to serve and may pay the same price. That gap is
        the risk of managed keys, and it is why a plan needs a limit. At $9.99 a month, the limit that keeps the target margin is {fmtInt(lim)}{" "}
        actions. See <Link href="/guides/unlimited-ai-plan-heavy-users">why unlimited plans lose money on heavy users</Link>.
      </p>

      <h2 id="byok">What BYOK costs you</h2>
      <p>
        Almost nothing in AI cost. The trade is elsewhere:
      </p>
      <ul>
        <li>
          <strong>Fewer customers.</strong> Many people have no API key and will not make one. Setup is the biggest drop-off.
        </li>
        <li>
          <strong>Less revenue per user.</strong> You cannot earn a markup on usage, so you price on features, not on tokens.
        </li>
        <li>
          <strong>Support load.</strong> Users hit rate limits, expired keys and surprise provider bills, and they ask you why.
        </li>
        <li>
          <strong>Key handling.</strong> You hold a secret that can spend money. A leak is your problem.
        </li>
        <li>
          <strong>Less control.</strong> You cannot cap what a user spends, and you cannot route to a cheaper model on your side to save them money
          unless you build it.
        </li>
      </ul>

      <h2 id="choose">How to choose</h2>
      <ul>
        <li>
          <strong>Users are developers or power users:</strong> offer BYOK, maybe as the only option for a cheap one-time or low monthly price.
        </li>
        <li>
          <strong>Users are consumers or small businesses:</strong> use managed keys, a monthly allowance and a limit. They expect it to work with no
          setup.
        </li>
        <li>
          <strong>Mixed:</strong> managed plan for most people, BYOK as a cheaper tier for those who want it.
        </li>
      </ul>
      <p>
        If your users run large jobs, such as hundreds of documents a day, managed pricing gets hard to keep above a margin, and BYOK or a credits
        plan is easier. <Link href="/guides/credits-vs-subscription-ai-app">Credits or subscription</Link> compares the options.
      </p>

      <h2 id="hybrid">If you offer both</h2>
      <p>
        Only the managed plans carry your AI cost, so give them a monthly AI limit by plan and check it on your backend before each AI call.
        FiscaLLM&apos;s <code>meter.check</code> returns the plan, what is left and when it resets (<Link href="/docs#plan-limits">limits by plan</Link>
        ). For a hard stop on one user&apos;s spend, add a per-user budget with Block (<Link href="/docs#caps">spending caps</Link>). Track the AI
        calls you pay for with one <code>meter.track</code> call and compare each user&apos;s cost with what they paid on the{" "}
        <Link href="/demo">dashboard</Link>.
      </p>
    </GuideShell>
  );
}
