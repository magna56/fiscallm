import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";

const TITLE = "How to stop one user from running up your OpenAI or Claude bill";
const PATH = "/guides/stop-runaway-ai-api-costs";
const DESCRIPTION =
  "Provider spend limits protect the whole account, not each user. How to add per-user budgets, a hard cap the backend enforces, rate limits and an alert for runaway loops, before the bill arrives.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  keywords: ["OpenAI bill shock", "limit OpenAI cost per user", "AI API abuse", "runaway AI cost", "per user spending cap LLM", "Claude API spend limit"],
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const FAQ: [string, string][] = [
  [
    "Doesn't OpenAI's usage limit already protect me?",
    "It protects the account: when the organization hits its limit, every user is cut off, including paying ones. It cannot tell which user caused the spend. You need a per-user budget in your own backend.",
  ],
  [
    "What is a runaway loop?",
    "An agent or retry loop that keeps calling the model without a human in between, often because a tool call fails and is retried forever. It can spend in minutes what a normal user spends in a month. Detect it by tokens per user per few minutes, not per day.",
  ],
  [
    "Should a cap fail open or closed?",
    "Tracking should never block your app. A cap is different: it should refuse once the user is past the budget, and keep refusing even if the tracking service is briefly unreachable, by counting locally too.",
  ],
];

export default function Guide() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} faq={FAQ}>
      <p>
        <strong>In short:</strong> count AI cost per user on your backend, give each user a daily and 30-day budget, refuse AI calls past it, rate
        limit bursts, and alert on tokens per user per five minutes to catch loops. Provider limits are a last line of defence for the whole account,
        not a per-user control.
      </p>

      <h2 id="layers">Four layers, cheapest first</h2>
      <ol>
        <li>
          <strong>Limits on the request.</strong> Cap reply length (<code>max_tokens</code>), trim chat history, and reject oversized uploads before
          they reach the model.
        </li>
        <li>
          <strong>Rate limits.</strong> A few requests per user per second or minute stops scripts and double-clicks. It does not stop a slow,
          steady heavy user.
        </li>
        <li>
          <strong>Per-user budgets.</strong> A dollar budget per user per day and per 30 days, checked before each call. This is the layer that
          actually caps cost per user. Plan allowances for free and paid users belong here too:{" "}
          <Link href="/guides/ai-usage-limits-by-plan">limits by plan</Link>.
        </li>
        <li>
          <strong>Account limits and alerts.</strong> Keep the provider&apos;s monthly limit as a backstop, and alert on daily spend for the whole
          app.
        </li>
      </ol>

      <h2 id="loops">Catch loops in minutes, not at month end</h2>
      <p>
        Daily budgets react too late for an agent stuck in a retry loop. Alert, and ideally block, when one user uses more tokens in five minutes
        than a real person could. Send the alert to Slack or email so someone sees it immediately.
      </p>

      <h2 id="fiscallm">With FiscaLLM</h2>
      <p>
        One line after each AI call reports token counts. In Settings you set per-user budgets (today and 30 days), tick Block to make them a cap, and
        turn on the runaway-loop alert. Before each call your backend asks <code>meter.check(userId)</code> and gets allow or refuse; the SDK also
        counts locally, so a loop is stopped even if FiscaLLM is unreachable. Free and open source:{" "}
        <Link href="/docs#caps">spending caps reference</Link> · <Link href="/docs#alerts">alerts</Link>.
      </p>

      <h2 id="before">Before launch</h2>
      <p>
        Decide what one user may cost you on each plan. The <Link href="/pricing-planner">pricing planner</Link> gives a monthly limit per plan that
        keeps your target margin; the daily cap can be that number divided by 30, times a few for headroom.
      </p>
    </GuideShell>
  );
}
