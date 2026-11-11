import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";

const TITLE = "How to limit AI usage per subscription plan (free, trial and paid)";
const PATH = "/guides/ai-usage-limits-by-plan";
const DESCRIPTION =
  "Give free, trial and paying users their own AI allowance, show how much is left, and open the paywall when it runs out. What to count, how to reset it, and the edge cases with RevenueCat and Stripe.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const FAQ: [string, string][] = [
  [
    "Should I limit AI usage by messages or by dollars?",
    "Show users a number of messages, because they understand it. Protect yourself with dollars, because one long message can cost as much as fifty short ones. Many apps use both: a visible message count for the free plan and a dollar fair-use limit for paid plans.",
  ],
  [
    "Can I enforce the limit in the mobile app instead of the backend?",
    "No. Anything checked in the app can be bypassed by calling your API directly. Count and check on the backend, and send the remaining number to the app only for display.",
  ],
  [
    "How do I know a user's plan on the backend with RevenueCat?",
    "Either store the plan from RevenueCat's webhooks, or ask RevenueCat's REST API for the subscriber when needed. FiscaLLM does the first for you: it receives the webhooks and answers with the user's plan and remaining allowance in one call.",
  ],
  [
    "What should happen when a paying user reaches the limit?",
    "Do not cut them off silently. Common choices are a slower or cheaper model for the rest of the period, an offer to move to a higher plan, or a pack of extra usage. Tell them when the allowance resets.",
  ],
  [
    "What does a free tier of an AI app cost?",
    "Multiply the limit by the cost of one call. 10 calls a day at $0.002 each is at most $0.60 per active free user a month. The free LLM pricing calculator on this site works it out for any model.",
  ],
];

export default function Guide() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} faq={FAQ}>
      <p>
        <strong>In short:</strong> decide what each plan gets (for example 10 AI messages a day on free, 500 a month on Pro), count every AI call per
        user on your backend, check the count before each call, and return how much is left so the app can show it. When the allowance is used up,
        answer with the paywall instead of the AI. The counting is easy. Knowing each user&apos;s plan at that moment, and resetting at the right
        time, is where most home-built versions go wrong.
      </p>
      <p>
        A limit does two jobs. It caps what a free user can cost you, and it is the moment a free user sees a reason to pay. Both need the same three
        things: the user&apos;s plan, their usage in the current period, and the number left.
      </p>

      <h2 id="count">1. Choose what to count</h2>
      <table>
        <thead>
          <tr>
            <th>Count</th>
            <th>Good for</th>
            <th>Watch out for</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>AI calls (messages, generations)</td>
            <td>Anything you show the user: &quot;3 messages left today&quot;</td>
            <td>Calls differ in cost. A long conversation or a big document costs many times a short question</td>
          </tr>
          <tr>
            <td>Dollars of AI cost</td>
            <td>Fair-use limits on paid plans; apps where one request can be very large</td>
            <td>Users cannot reason about it, so do not show it as is. Needs a price for every model you use</td>
          </tr>
          <tr>
            <td>Tokens</td>
            <td>Rarely the right choice</td>
            <td>Input, output and cached tokens have different prices, so a token count is neither a cost nor something users understand</td>
          </tr>
        </tbody>
      </table>
      <p>
        If one message in your app makes several model calls (a tool-using agent, a retry, a summary step), count the user-visible action yourself
        or limit by dollars. Otherwise &quot;20 messages&quot; quietly becomes 6.
      </p>

      <h2 id="period">2. Choose the period</h2>
      <table>
        <thead>
          <tr>
            <th>Period</th>
            <th>Typical use</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>In total (never resets)</td>
            <td>&quot;5 free tries, then subscribe.&quot; The strongest push to pay, and the cheapest free tier</td>
          </tr>
          <tr>
            <td>Per day</td>
            <td>Free plans that should build a habit; a safety cap during a free trial, when cost is real and revenue is $0</td>
          </tr>
          <tr>
            <td>Per month</td>
            <td>Paid plans. Matches how people think about a subscription</td>
          </tr>
        </tbody>
      </table>
      <p>
        Pick one clock for resets and say so in the app. A UTC day is the simplest to build and explain (&quot;resets at 00:00 UTC&quot;). A rolling 24
        hours feels fairer but means storing every call&apos;s time. For monthly limits, a calendar month is simple; the user&apos;s billing period is
        more exact but changes with every upgrade, pause and renewal.
      </p>

      <h2 id="plan">3. Know the user&apos;s plan on your backend</h2>
      <p>
        The app knows the plan (RevenueCat&apos;s SDK returns the active entitlements), but the app can&apos;t be trusted to enforce a limit. Your
        backend needs its own answer:
      </p>
      <ul>
        <li>
          <strong>RevenueCat:</strong> add a webhook and keep the latest state per app user ID: trial or paid, the product, and the expiry date.{" "}
          <code>INITIAL_PURCHASE</code>, <code>RENEWAL</code>, <code>PRODUCT_CHANGE</code>, <code>CANCELLATION</code> and <code>EXPIRATION</code> are the
          events that change it.
        </li>
        <li>
          <strong>Stripe:</strong> listen for <code>customer.subscription.created</code>, <code>updated</code> and <code>deleted</code>, and map the
          price to a plan. <code>trialing</code> and <code>active</code> have access; <code>past_due</code> is your call.
        </li>
        <li>No record means a free user.</li>
      </ul>
      <p>
        Use the same user ID in billing and in your AI tracking. With RevenueCat that means logging users in with your own ID, or sending the
        anonymous ID to your backend; see <Link href="/guides/ai-margin-per-user-revenuecat">the RevenueCat guide</Link>.
      </p>

      <h2 id="store">4. Count and check</h2>
      <p>The smallest version is one table and two statements:</p>
      <pre>
        <code>{`CREATE TABLE ai_usage (
  user_id text, day date, calls int NOT NULL DEFAULT 0, cost_usd numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- before the call
SELECT coalesce(sum(calls), 0) FROM ai_usage WHERE user_id = $1 AND day = current_date;

-- after the call
INSERT INTO ai_usage (user_id, day, calls, cost_usd) VALUES ($1, current_date, 1, $2)
ON CONFLICT (user_id, day) DO UPDATE
  SET calls = ai_usage.calls + 1, cost_usd = ai_usage.cost_usd + excluded.cost_usd;`}</code>
      </pre>
      <p>
        One row per user per day covers every period: today is one row, this month is a sum over at most 31, and a total is a sum over all of them.
        No reset job is needed, because a new day is simply a new row.
      </p>
      <p>Then answer the app with enough to draw the right screen:</p>
      <pre>
        <code>{`// allowed
200 { "reply": "…", "remaining": 3, "resetsAt": "2026-11-12T00:00:00Z" }

// used up: the app opens the paywall
402 { "paywall": true, "plan": "free", "resetsAt": "2026-11-12T00:00:00Z" }`}</code>
      </pre>
      <p>
        Show the remaining number before the user runs out (&quot;3 left today&quot;), not only at zero. People upgrade more readily when the limit
        was visible all along than when it appears as an error.
      </p>

      <h2 id="edge">5. The cases that break home-built limits</h2>
      <ul>
        <li>
          <strong>A renewal that arrives late.</strong> If you treat a subscription as ended the second its period ends, a paying user drops to the
          free limits until the renewal event arrives. Allow some hours of grace.
        </li>
        <li>
          <strong>Cancelled is not expired.</strong> A user who turned off auto-renew has paid until the end of the period and keeps the paid limits
          until then.
        </li>
        <li>
          <strong>Trials.</strong> A trial user has the paid features but has paid nothing, and some people start trials to use a month of AI in three
          days. Give trials their own daily limit.
        </li>
        <li>
          <strong>Anonymous then logged in.</strong> RevenueCat merges the two IDs as aliases. If usage was counted under the anonymous ID and the
          plan sits on the new one, the user gets a fresh allowance or loses their plan. Count all aliases as one person.
        </li>
        <li>
          <strong>Calls at the same moment.</strong> Ten requests sent together all pass a check made before any of them is counted. For a soft limit
          that is fine. For a hard one, count first and refund on failure, or lock per user.
        </li>
        <li>
          <strong>Streaming.</strong> The cost is known only when the stream ends. Check before, count after.
        </li>
        <li>
          <strong>Your limiter is down.</strong> Decide in advance: allow (a short burst of free usage) or refuse (your app is down too). Most apps
          should allow, with a small in-process cap as a backstop.
        </li>
        <li>
          <strong>Upgrades mid-period.</strong> Apply the new plan&apos;s limits at once and keep the usage already counted. Resetting to zero on
          upgrade is generous; hiding the old usage on downgrade is a loophole.
        </li>
      </ul>

      <h2 id="fiscallm">6. Or let FiscaLLM do it</h2>
      <p>
        FiscaLLM is open source and does the parts above: it receives the RevenueCat or Stripe events, keeps each user&apos;s plan, counts AI calls
        and prices them, and answers one question from your backend.
      </p>
      <pre>
        <code>{`import { createMeter } from "fiscallm";
const meter = createMeter({ apiKey: process.env.FISCALLM_KEY });

const { allow, plan, limits } = await meter.check(userId);
if (!allow) return respond(402, { paywall: true, plan, resetsAt: limits[0]?.resetsAt });

const reply = await openai.chat.completions.create({ ... });
meter.trackOpenAI(reply, { userId });                     // counted and priced

return { reply, remaining: limits[0]?.remaining };        // "3 left today"`}</code>
      </pre>
      <p>
        The limits themselves are settings, not code: on the app&apos;s <strong>Limits</strong> page you add rows like <code>free</code>, 10 AI
        calls a day; <code>trial</code>, 30 a day; <code>pro_yearly</code>, $8 of AI a month. Changing a limit needs no deploy and no app release.
        The same page lists the users who are at a limit right now, and the rest of the dashboard shows what each plan&apos;s AI costs against what
        it earns, so you can tell whether a limit is too tight or too generous.
      </p>
      <p>
        <Link href="/login">Create an app</Link> (free, no card), read the <Link href="/docs#plan-limits">reference</Link>, or{" "}
        <a href="https://github.com/magna56/fiscallm">run it yourself</a>.
      </p>
    </GuideShell>
  );
}
