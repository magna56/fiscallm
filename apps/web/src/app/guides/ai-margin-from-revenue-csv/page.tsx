import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";

const TITLE = "How to calculate AI margin per user from a revenue CSV (Paddle, Lemon Squeezy, spreadsheets)";
const PATH = "/guides/ai-margin-from-revenue-csv";
const DESCRIPTION =
  "No webhook? Export payments from Paddle, Lemon Squeezy, Stripe or a spreadsheet as CSV and join them to each user's LLM cost. The columns you need, net revenue, refunds, and how not to double count.";

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
        <strong>In short:</strong> every billing system can export payments as CSV. If each row carries the same user ID your backend uses for AI
        calls, you can compute AI margin per user without wiring up a single webhook: net revenue per user minus AI cost per user, over the same
        period.
      </p>
      <p>
        This is the fastest way to answer &quot;which users cost more than they pay?&quot; for apps on Paddle, Lemon Squeezy, Gumroad, an invoicing
        tool, or a hand-kept spreadsheet, and for history from before you connected anything else.
      </p>

      <h2 id="columns">1. The columns you need</h2>
      <table>
        <thead>
          <tr>
            <th>Column</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>id</code></td><td>The payment or invoice ID. Makes re-imports safe: the same ID is never counted twice</td></tr>
          <tr><td><code>user_id</code></td><td>The ID your backend sends with AI calls. Without it there is no join</td></tr>
          <tr><td><code>type</code></td><td>purchase, renewal, refund, trial_started, cancellation or expiration</td></tr>
          <tr><td><code>ts</code></td><td>When it happened (a date is enough)</td></tr>
          <tr><td><code>amount_usd</code></td><td>What the customer paid, or the amount refunded</td></tr>
          <tr><td><code>net_usd</code> (optional)</td><td>What you kept after tax and fees; or give <code>tax_pct</code> and <code>fee_pct</code></td></tr>
          <tr><td><code>period_end</code> (optional)</td><td>When the paid period ends, so you know who is still a paying user</td></tr>
        </tbody>
      </table>
      <pre>
        <code>{`id,user_id,type,ts,amount_usd,net_usd,product_id,period_end
in_001,user_42,purchase,2026-10-01,20,17.12,pro_monthly,2026-11-01
in_002,user_42,renewal,2026-11-01,20,17.12,pro_monthly,2026-12-01
re_001,user_7,refund,2026-10-12,20,20,pro_monthly,`}</code>
      </pre>

      <h2 id="exports">2. Getting the export</h2>
      <ul>
        <li>
          <strong>Paddle:</strong> export transactions from the dashboard. Pass your user ID as <code>custom_data</code> at checkout so it appears in the
          export; otherwise map Paddle customer IDs to your users first. Paddle is the merchant of record, so &quot;earnings&quot; is already net of tax and
          its fee: use it as <code>net_usd</code>.
        </li>
        <li>
          <strong>Lemon Squeezy:</strong> export orders. Pass your user ID as <code>checkout[custom][user_id]</code>. Like Paddle, it handles tax, so
          the payout amount is your net.
        </li>
        <li>
          <strong>Stripe:</strong> export Payments or Invoices, and include the <code>metadata.user_id</code> column. Or skip the CSV and{" "}
          <Link href="/guides/ai-cost-per-customer-stripe">import from Stripe directly</Link>.
        </li>
        <li>
          <strong>App Store and Google Play:</strong> their reports have no user IDs. Use RevenueCat or your own server notifications instead.
        </li>
      </ul>

      <h2 id="net">3. Net revenue, refunds and currencies</h2>
      <ul>
        <li>
          <strong>Use net, not gross.</strong> Card fees, store commissions, merchant-of-record fees and tax can take 10-35% of the sticker price.
          Margin against gross revenue flatters every user.
        </li>
        <li>
          <strong>Refunds are positive amounts of type refund.</strong> They take revenue away, but the AI cost the user ran up stays.
        </li>
        <li>
          <strong>One currency.</strong> Convert to USD at the rate on the payment date before you compare it with AI cost, which is billed in USD.
        </li>
      </ul>

      <h2 id="join">4. Join with AI cost</h2>
      <pre>
        <code>{`margin(user) = Σ net_usd (payments − refunds) − Σ ai_cost   // same user, same period`}</code>
      </pre>
      <p>
        AI cost per user comes from your backend: after each call, read the token counts and price them for the model (see the{" "}
        <Link href="/guides/track-openai-cost-per-user">OpenAI</Link> and <Link href="/guides/track-anthropic-claude-cost-per-user">Anthropic</Link>{" "}
        guides). Use a period long enough to include each user&apos;s payment: monthly plans need at least 30 days, annual plans 90 days or more.
      </p>

      <h2 id="ongoing">5. Keep it current</h2>
      <p>
        A CSV is a snapshot. Re-export each week or month and import the whole file again; with a stable <code>id</code> per row, rows already counted
        are skipped. When you outgrow that, send each payment from your backend as it happens with a revenue API, and keep CSV for backfills.
      </p>

      <h2 id="fiscallm">The shortcut</h2>
      <p>
        FiscaLLM takes this CSV as is. Upload it on the Setup page; common column names like <code>customer</code>, <code>date</code> and{" "}
        <code>amount</code> are recognised, bad rows are listed by line number, and re-uploading skips what is already there. Report AI usage with one
        line per call and you see margin per user, per plan and per trial, with alerts when someone starts losing you money.
      </p>
      <p>
        It&apos;s free and open source (MIT) and can be self-hosted. <Link href="/demo">Open the demo dashboard</Link> (sample data, no sign-up), read{" "}
        <Link href="/docs#revenue-csv">the CSV docs</Link>, or <Link href="/login">start free</Link>.
      </p>

      <h2 id="faq">Questions</h2>
      <h3>Do I need a webhook to track AI margin?</h3>
      <p>No. A CSV export with a user ID per row is enough to start. Webhooks only save you from re-exporting.</p>
      <h3>What if my export has no user ID?</h3>
      <p>
        Map the billing system&apos;s customer ID or email to your own user ID first, or report AI usage under the billing customer ID. Either way both
        sides need the same ID.
      </p>
      <h3>Can I mix CSV with Stripe or RevenueCat?</h3>
      <p>Yes, as long as each payment comes from one source. Sending the same payment twice under different IDs counts it twice.</p>
    </GuideShell>
  );
}
