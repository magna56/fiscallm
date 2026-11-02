import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";

const TITLE = "How to track AI cost per customer against Stripe revenue";
const PATH = "/guides/ai-cost-per-customer-stripe";
const DESCRIPTION =
  "Match each Stripe customer's payments to their OpenAI, Anthropic or Gemini cost. Tag users in Stripe metadata, compute net revenue after fees and tax, handle trials and refunds, and backfill past invoices.";

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
        <strong>In short:</strong> AI margin per customer is what the customer paid you through Stripe, minus tax and Stripe&apos;s fee, minus what their
        AI usage cost. Stripe knows the first half, your AI provider knows the second, and nothing joins them unless both use the same customer ID.
      </p>
      <p>
        A flat $20 plan can hide a customer who costs you $60 a month in tokens. Averages won&apos;t show it; per-customer numbers will. This guide
        shows how to build that join, and the traps that make the numbers wrong.
      </p>

      <h2 id="user-id">1. Put your user ID on the Stripe subscription</h2>
      <p>
        Your backend knows your user ID when it calls the AI provider. Stripe knows a <code>cus_…</code> customer ID. Pick one and use it on both
        sides. The simplest way is to write your user ID into Stripe metadata when you create the checkout session or subscription:
      </p>
      <pre>
        <code>{`await stripe.checkout.sessions.create({
  mode: "subscription",
  line_items: [{ price: "price_pro", quantity: 1 }],
  subscription_data: { metadata: { user_id: user.id } },
  customer_email: user.email,
  // …
});`}</code>
      </pre>
      <p>
        Now every invoice for that subscription carries <code>user_id</code> in its subscription details, and you can attribute it without a lookup
        table. If you can&apos;t change checkout, store the <code>cus_…</code> ID on your user record and report AI usage under that instead.
      </p>

      <h2 id="events">2. Listen to the Stripe events that move revenue</h2>
      <table>
        <thead>
          <tr>
            <th>Stripe event</th>
            <th>What it means for margin</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><code>invoice.paid</code></td><td>Money in. <code>billing_reason</code> tells a first payment from a renewal</td></tr>
          <tr><td><code>customer.subscription.created</code> (trialing)</td><td>A trial starts: AI cost begins, revenue is $0</td></tr>
          <tr><td><code>customer.subscription.updated</code></td><td>Auto-renew switched off when <code>cancel_at_period_end</code> turns true</td></tr>
          <tr><td><code>customer.subscription.deleted</code></td><td>Access ended: no more revenue, cost may continue</td></tr>
          <tr><td><code>charge.refunded</code></td><td>Money back out. <code>amount_refunded</code> is a running total, so count only the new part</td></tr>
        </tbody>
      </table>
      <p>
        Verify the <code>Stripe-Signature</code> header on every request, and de-duplicate on the event ID: Stripe retries deliveries, sometimes hours
        later.
      </p>

      <h2 id="net">3. Use net revenue, not the invoice total</h2>
      <pre>
        <code>{`net = amount_paid − tax − (amount_paid × 2.9% + $0.30)   // Stripe's standard US card fee`}</code>
      </pre>
      <p>
        On a $20 invoice that is about $19.12 before tax, and less if you collect sales tax or VAT. The exact fee is on the balance transaction; the
        standard rate is close enough for margin unless you have negotiated pricing or many international cards.
      </p>

      <h2 id="ai-cost">4. Record AI cost under the same ID</h2>
      <p>
        After each AI call, read the token counts from the response and price them for the model used. Cached input, cache writes and long prompts
        are priced differently, so use the provider&apos;s full price table. Store cost per user per day; that is all the join needs. The{" "}
        <Link href="/guides/track-openai-cost-per-user">OpenAI</Link> and <Link href="/guides/track-anthropic-claude-cost-per-user">Anthropic</Link>{" "}
        guides cover the details.
      </p>

      <h2 id="backfill">5. Backfill past invoices</h2>
      <p>
        A webhook only sees events from the day you add it. Customers who paid last month look like free users until they renew. Backfill once
        through the API with a <strong>restricted key</strong> that can only read:
      </p>
      <ul>
        <li>
          In Stripe, Developers → API keys → Create restricted key. Give it <em>Read</em> on Invoices, Charges and Refunds, and Subscriptions, and
          nothing else.
        </li>
        <li>
          List <code>/v1/invoices?status=paid</code>, <code>/v1/refunds</code> and <code>/v1/subscriptions</code> for the period you care about, and
          run each object through the same mapping as the webhook.
        </li>
        <li>
          De-duplicate on the <strong>invoice ID</strong>, not the event ID: the backfill and the webhook see the same invoice under different event
          IDs, and you must not count it twice.
        </li>
        <li>Delete the key when you are done.</li>
      </ul>

      <h2 id="traps">6. Traps that make the numbers wrong</h2>
      <ul>
        <li>
          <strong>Trials have cost and no revenue.</strong> Mark the first paid invoice after a trial as a conversion, and measure cost per{" "}
          <em>converted</em> trial: a $2 trial that converts 20% of the time costs $10 per customer.
        </li>
        <li>
          <strong>Annual plans arrive in one payment.</strong> Measure over 90 days or more, or spread the payment across the months it covers.
        </li>
        <li>
          <strong>Refunds reverse revenue, not cost.</strong> The customer still used the AI.
        </li>
        <li>
          <strong>Currencies.</strong> Convert everything to one currency on the day of payment, or keep USD-only customers separate.
        </li>
        <li>
          <strong>Free users</strong> never produce an invoice. Keep them in their own bucket instead of treating a missing match as an error.
        </li>
      </ul>

      <h2 id="fiscallm">The shortcut</h2>
      <p>
        FiscaLLM does all of the above. Paste one webhook URL from the Setup page, then paste a read-only restricted key to import the last 12 months;
        the key is used once and never stored, and invoices are counted once whether they arrive by webhook or import. Report AI usage with one line
        per call, and you get margin per customer, per plan and per trial cohort, with alerts when a customer starts losing you money.
      </p>
      <pre>
        <code>{`meter.trackOpenAI(res, { userId, feature: "chat" });   // userId = metadata.user_id on the subscription
// Setup → Connect Stripe (webhook) → Import the last 12 months (restricted key)`}</code>
      </pre>
      <p>
        It&apos;s free and open source (MIT), and you can self-host it so your revenue data never leaves your servers. The Stripe connector is in beta
        and USD only. <Link href="/demo">Open the demo dashboard</Link> (sample data, no sign-up), read <Link href="/docs#stripe">the Stripe docs</Link>,
        or <Link href="/login">start free</Link>. Not on Stripe? See <Link href="/guides/ai-margin-from-revenue-csv">margin from a revenue CSV</Link> or{" "}
        <Link href="/guides/ai-margin-per-user-revenuecat">RevenueCat</Link>.
      </p>

      <h2 id="faq">Questions</h2>
      <h3>Does Stripe show AI cost per customer?</h3>
      <p>
        No. Stripe records what customers pay and, with usage-based billing, what you report to it, but it doesn&apos;t know what each customer cost you
        at OpenAI or Anthropic. That has to come from your backend and be joined by customer ID.
      </p>
      <h3>Should I use Stripe usage-based billing instead?</h3>
      <p>
        Usage billing passes cost on to the customer; it doesn&apos;t tell you your margin. Most AI apps keep a flat plan and need to see which
        customers the flat price doesn&apos;t cover.
      </p>
      <h3>Is a restricted key safe to share with a tool?</h3>
      <p>
        A restricted key with only Read access can&apos;t move money or change anything. Give it the fewest permissions the job needs, and delete it
        once the import is done.
      </p>
    </GuideShell>
  );
}
