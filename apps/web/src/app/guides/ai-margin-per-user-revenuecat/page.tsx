import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";

const TITLE = "How to calculate AI margin per user in a RevenueCat app";
const PATH = "/guides/ai-margin-per-user-revenuecat";
const DESCRIPTION =
  "Match each user's AI cost to their RevenueCat revenue. Use the right user ID, compute net revenue after store fees and tax, and handle trials, annual plans and refunds.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

export default function Guide() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH}>
      <p>
        <strong>In short:</strong> AI margin per user is what a user paid you, net of store fees and tax, minus what their AI usage cost. The hard part
        isn&apos;t the arithmetic. It&apos;s using the <em>same user ID</em> in your AI tracking and in RevenueCat, and counting revenue the way it
        really arrives.
      </p>
      <p>
        RevenueCat tells you who paid. Your AI provider tells you how many tokens you used. Neither knows about the other, so margin per user has to
        be built by joining them.
      </p>

      <h2 id="user-id">1. Use the RevenueCat user ID everywhere</h2>
      <p>
        Every join below depends on one value: the RevenueCat <strong>app user ID</strong>. Your backend must report each AI call under that exact ID.
      </p>
      <p>
        <strong>Best option:</strong> log users into RevenueCat with your own user ID (<code>Purchases.logIn(yourUserId)</code>). Then the RevenueCat
        ID is the ID your backend already has from your own auth, and nothing extra needs to travel.
      </p>
      <p>
        <strong>If you use RevenueCat&apos;s anonymous IDs</strong> (they start with <code>$RCAnonymousID:</code>), your backend doesn&apos;t know the
        value. Send it from the app with each AI request, for example in a header:
      </p>
      <table>
        <thead>
          <tr>
            <th>Platform</th>
            <th>Get the app user ID</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>iOS (Swift)</td><td><code>Purchases.shared.appUserID</code></td></tr>
          <tr><td>Android (Kotlin)</td><td><code>Purchases.sharedInstance.appUserID</code></td></tr>
          <tr><td>React Native</td><td><code>await Purchases.getAppUserID()</code></td></tr>
          <tr><td>Flutter</td><td><code>await Purchases.appUserID</code></td></tr>
        </tbody>
      </table>
      <pre>
        <code>{`// backend: use the ID you were sent (or better, the one tied to your auth)
const userId = req.headers["x-rc-app-user-id"];`}</code>
      </pre>
      <p>
        A header sent by the app can be faked, so for money decisions prefer an ID you derive from your own authenticated session. For measuring
        margin, a header is fine.
      </p>
      <p>
        <strong>Aliases:</strong> when a user goes from anonymous to logged in, RevenueCat merges the IDs and lists the old ones as aliases. Your
        join should treat all of a user&apos;s aliases as one person, otherwise their cost and their revenue land on different IDs.
      </p>

      <h2 id="revenue">2. Get revenue from RevenueCat</h2>
      <p>
        Add a webhook (Integrations → Webhooks) that points at your own endpoint. Each event describes one thing that happened to a subscription. The
        ones that matter for revenue:
      </p>
      <table>
        <thead>
          <tr>
            <th>Event</th>
            <th>What it means for margin</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>INITIAL_PURCHASE</code> (trial)</td><td>A trial starts: AI cost begins, revenue is $0</td></tr>
          <tr><td><code>INITIAL_PURCHASE</code> (paid)</td><td>First payment: add net revenue</td></tr>
          <tr><td><code>RENEWAL</code></td><td>Another payment: add net revenue. A trial conversion is marked on the first one</td></tr>
          <tr><td><code>CANCELLATION</code></td><td>Auto-renew turned off, or a refund (negative price): subtract refunds</td></tr>
          <tr><td><code>EXPIRATION</code></td><td>Access ended: no more revenue, but cost may continue if you don&apos;t cut them off</td></tr>
          <tr><td><code>PRODUCT_CHANGE</code></td><td>Plan changed: attribute future cost to the new plan</td></tr>
        </tbody>
      </table>
      <p>
        Two practical rules: de-duplicate on the event ID (RevenueCat retries deliveries), and ignore sandbox events in production reporting.
      </p>

      <h2 id="net">3. Use net revenue, not the sticker price</h2>
      <p>
        The App Store and Google Play keep a cut, and tax is collected on top. Each event carries the price and both percentages, so:
      </p>
      <pre>
        <code>{`net_revenue = price_usd × (1 − tax_percentage − commission_percentage)`}</code>
      </pre>
      <p>
        On a $9.99 plan a 15% store cut and some tax can leave you with well under $8. Measuring margin against $9.99 overstates it for every user.
      </p>

      <h2 id="margin">4. Compute margin, and watch for these traps</h2>
      <pre>
        <code>{`margin = net_revenue − ai_cost     (same user, same time window)`}</code>
      </pre>
      <ul>
        <li>
          <strong>Free trials have cost and no revenue.</strong> Measure cost per trial and per <em>converted</em> trial, grouped by trial start week.
          A trial that costs $2 and converts 20% of the time really costs $10 per customer.
        </li>
        <li>
          <strong>Annual plans arrive in one lump.</strong> A user who paid $59 in January and uses AI every month looks wildly profitable in January
          and wildly unprofitable in February if you measure by month. Use a window long enough to cover the payment (90 days or more), or spread the
          payment across the year.
        </li>
        <li>
          <strong>Refunds reverse revenue but not cost.</strong> A refunded user still used the AI. Subtract the refund and keep the cost.
        </li>
        <li>
          <strong>Free users are cost with no revenue by design.</strong> They never produce a purchase event. Report them as a separate
          &quot;free or unmatched&quot; bucket instead of treating a missing match as an error. A match rate shows whether the IDs line up.
        </li>
        <li>
          <strong>Past subscribers.</strong> Webhooks only send new events. People who subscribed before you connected show up only at their next
          renewal, so import them once through RevenueCat&apos;s API.
        </li>
      </ul>

      <h2 id="fiscallm">The shortcut</h2>
      <p>
        FiscaLLM does the join for you. One line reports AI cost under the user&apos;s ID, a RevenueCat webhook reports payments, and you get margin per
        user, per plan and per trial cohort, with alerts when someone crosses a budget. Aliases, net revenue, de-duplication and refunds are handled.
        Annual plans are counted when the payment arrives, so use a 90-day view for them.
      </p>
      <pre>
        <code>{`meter.trackOpenAI(res, { userId, feature: "chat" });   // userId = RevenueCat app user ID
// RevenueCat → Integrations → Webhooks → paste the URL and authorization value from your Setup page`}</code>
      </pre>
      <p>
        It&apos;s free and open source. <Link href="/demo">Open the demo dashboard</Link> (no sign-up), read <Link href="/how-it-works">how it works</Link>
        , or <Link href="/login">start free</Link>. Per-provider details:{" "}
        <Link href="/guides/track-openai-cost-per-user">OpenAI</Link> and{" "}
        <Link href="/guides/track-anthropic-claude-cost-per-user">Anthropic Claude</Link>.
      </p>

      <h2 id="faq">Questions</h2>
      <h3>Does RevenueCat show AI cost?</h3>
      <p>No. It reports revenue and subscription state only, so AI cost has to come from your own backend and be joined by user ID.</p>
      <h3>What if I don&apos;t use RevenueCat?</h3>
      <p>The same method works with any billing system: report each payment, refund and cancellation under the same user ID your AI calls use.</p>
      <h3>Which user ID should I use?</h3>
      <p>The RevenueCat app user ID. If you log users in with your own ID, that is your own ID.</p>
    </GuideShell>
  );
}
