import type { Metadata } from "next";
import Link from "next/link";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = {
  title: "How FiscaLLM works · FiscaLLM",
  alternates: { canonical: "/how-it-works" },
  description: "The architecture behind FiscaLLM: what the SDK sends, how cost is priced, how revenue is joined to it, and what happens when something fails.",
};

const DIAGRAM = `  Your backend                                   FiscaLLM
 ┌──────────────────────┐                  ┌───────────────────────────────┐
 │ AI call ─▶ provider  │                  │ POST /api/v1/events           │
 │    │                 │   token counts   │   validate · price · dedupe   │
 │    └─ meter.track() ─┼─────────────────▶│   └▶ ai_events + daily_user_  │
 │      (background)    │   (no prompts)   │       cost  (one transaction) │
 └──────────────────────┘                  │                               │
                                           │ POST /api/webhooks/rc/:app    │
 RevenueCat / your billing ───────────────▶│   verify · dedupe · apply     │
     purchases, renewals, refunds          │   └▶ rc_events + subscribers  │
                                           │                               │
                                           │ metrics: cost ⨝ revenue       │
                                           │   per user, plan, trial       │
                                           └───────────────┬───────────────┘
                                                           ▼
                                            dashboard · alerts · weekly email`;

export default function HowItWorksPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <Prose>
        <h1>How FiscaLLM works</h1>
        <p>
          <strong>In short:</strong> your backend reports token counts, your billing system reports payments, and FiscaLLM joins the two on the
          user ID. Nothing sits in the path of your AI requests. This page is the technical version; <Link href="/docs">the docs</Link> have the
          setup steps.
        </p>

        <h2 id="architecture">Architecture</h2>
        <pre>
          <code>{DIAGRAM}</code>
        </pre>
        <p>
          Two inputs, both one-way and asynchronous: usage events from your backend, and revenue events from RevenueCat (or from your own code).
          Everything else is computed from those two tables.
        </p>

        <h2 id="usage">1. Usage: what the SDK sends</h2>
        <p>
          You call <code>meter.trackOpenAI(res, {"{ userId }"})</code> after the provider responds. The SDK reads the usage object from the response
          and queues an event. It never reads message content.
        </p>
        <div className="my-5 rounded-2xl border border-[#6d5dfc]/20 bg-[#6d5dfc]/[0.06] p-4 text-sm">
          <p className="!my-0 font-medium text-foreground">What is <code>res</code>? And what do we read from it?</p>
          <p className="!my-1.5">
            <code>res</code> is the object your AI provider&apos;s SDK returned for the call you just made. FiscaLLM reads exactly two things from it:{" "}
            <strong>the model name</strong> and <strong>the token counts</strong> (<code>res.usage</code>).
          </p>
          <p className="!my-0">
            It never reads the answer text, the prompt or any message content, and none of that is sent. Only the model name and the counts leave your backend.
          </p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>id</code></td><td>UUID made by the SDK. The same event retried has the same id.</td></tr>
            <tr><td><code>userId</code></td><td>Your user, ideally the RevenueCat app user ID.</td></tr>
            <tr><td><code>provider</code>, <code>model</code></td><td>For example <code>openai</code> and <code>gpt-5-mini</code>.</td></tr>
            <tr><td><code>inputTokens</code>, <code>outputTokens</code></td><td>Cached reads and cache writes are separate fields, so each is priced at its own rate.</td></tr>
            <tr><td><code>units</code>, <code>unit</code>, <code>variant</code></td><td>For per-image, per-second, per-minute or per-character models.</td></tr>
            <tr><td><code>costUsd</code></td><td>Optional exact cost. Wins over the price table.</td></tr>
            <tr><td><code>feature</code></td><td>Your label for the call site, such as <code>chat</code>.</td></tr>
          </tbody>
        </table>
        <p>
          Events are batched (up to 100 per request) and sent in the background: through <code>waitUntil</code> on Workers and Vercel, on a two-second
          timer on a long-running server, or on <code>meter.flush()</code> in Lambda-style runtimes. A request has a short timeout and one retry,
          then the batch is dropped. Tracking never throws and never delays your response.
        </p>

        <h2 id="pricing">2. Pricing each event</h2>
        <p>
          The API authenticates the ingest key (stored as a hash), validates the batch, and prices every event on arrival:
        </p>
        <ul>
          <li>If the event has <code>costUsd</code>, that is the cost.</li>
          <li>Otherwise tokens are multiplied by the model&apos;s per-million-token rates, with separate rates for input, output, cache reads and cache writes.</li>
          <li>Unit-priced models multiply <code>units</code> by the per-unit price for that <code>variant</code>.</li>
          <li>A model with no price is stored with no cost and listed as <strong>unpriced</strong> in the dashboard, so it is never silently counted as zero. You can set your own price in Settings.</li>
        </ul>
        <p>
          The event insert and the per-user daily rollup (<code>daily_user_cost</code>) happen in one transaction. The insert uses{" "}
          <code>ON CONFLICT DO NOTHING</code> on the event id, so a retried batch cannot count twice. The API answers <code>202</code>.
        </p>

        <h2 id="revenue">3. Revenue: RevenueCat, Stripe or your own</h2>
        <p>
          RevenueCat posts every subscription event to a per-app webhook. The request must carry the secret we generated for that app, compared in
          constant time. Each event is deduplicated on its RevenueCat event id, stored raw, then applied to a <code>subscribers</code> row:
        </p>
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Effect</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Initial purchase, trial</td><td>Trial started</td></tr>
            <tr><td>Initial purchase, paid</td><td>Paid; net revenue added</td></tr>
            <tr><td>Renewal</td><td>Net revenue added; a trial conversion is marked converted</td></tr>
            <tr><td>Cancellation with a refund</td><td>Refund subtracted</td></tr>
            <tr><td>Expiration, product change, transfer</td><td>State and plan updated; history moved on transfer</td></tr>
          </tbody>
        </table>
        <p>
          <strong>Net revenue</strong> is <code>price × (1 − tax − store commission)</code>, in USD, so margins are after the store takes its cut.
          Sandbox events are ignored unless you turn on test mode. Not on RevenueCat? Connect Stripe (below), or send the same kinds of events with{" "}
          <Link href="/docs#revenue-api">the revenue API</Link>. Subscribers who paid before the webhook existed can be{" "}
          <Link href="/docs#revenuecat">imported from RevenueCat</Link> once.
        </p>

        <h3 id="stripe">Stripe (beta)</h3>
        <p>
          Add a Stripe webhook endpoint pointing at your app&apos;s FiscaLLM URL and paste its signing secret into the Setup page. We store the secret
          encrypted, and every request must carry a valid <code>Stripe-Signature</code>: an HMAC of the raw body with a timestamp, checked in constant
          time, with a five-minute window against replays. Verified events are turned into the same revenue events the revenue API takes, so they follow
          exactly the same path as RevenueCat events.
        </p>
        <table>
          <thead>
            <tr>
              <th>Stripe event</th>
              <th>Effect</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>invoice.paid</code></td><td>A purchase (first invoice) or renewal; the first payment after a trial marks the conversion</td></tr>
            <tr><td><code>customer.subscription.created</code> (trialing)</td><td>Trial started</td></tr>
            <tr><td><code>customer.subscription.updated</code></td><td>Auto-renew switched off is a cancellation</td></tr>
            <tr><td><code>customer.subscription.deleted</code></td><td>Subscription ended</td></tr>
            <tr><td><code>charge.refunded</code></td><td>Only the new part of the refund is subtracted, so partial refunds are not counted twice</td></tr>
          </tbody>
        </table>
        <p>
          The user is read from <code>metadata.user_id</code> on the subscription or customer, or else the Stripe customer ID is used. What you keep is
          the payment minus tax minus an <em>estimate</em> of Stripe&apos;s fee (2.9% + $0.30), not the exact fee. USD only for now. See{" "}
          <Link href="/docs#stripe">the docs</Link>.
        </p>

        <h2 id="join">4. Joining cost to revenue</h2>
        <p>
          The join key is the user ID. RevenueCat events carry aliases (anonymous IDs, merged accounts), and every alias is stored against one
          canonical ID. AI events are resolved through that map at query time, so a user who was anonymous and later logged in is one person.
        </p>
        <p>
          Users with AI cost and no subscription are reported as <strong>free or unmatched</strong>. That bucket is expected to be large, since free
          users never produce a payment. The Setup page shows a match rate so you can tell a healthy bucket from a wrong user ID.
        </p>

        <h2 id="metrics">5. What gets computed</h2>
        <ul>
          <li><strong>Margin per user:</strong> net revenue minus AI cost over the selected window.</li>
          <li><strong>AI cost as a share of revenue:</strong> for the app and for each plan.</li>
          <li><strong>Users losing money:</strong> paying users with a negative margin, worst first.</li>
          <li><strong>Trial cohorts:</strong> AI cost of a start-week cohort, and per converted trial. Recent cohorts are provisional until their trials end.</li>
          <li><strong>Cost by model and by feature:</strong> straight sums over the events.</li>
        </ul>
        <p>
          Dashboards read the daily rollup, not the raw events, so they stay fast as volume grows. Raw events are deleted after 90 days; the
          rollup is kept.
        </p>

        <h2 id="alerts">6. Alerts</h2>
        <p>
          A daily job compares each user&apos;s and the whole app&apos;s spend with the budgets you set, per plan or per app. A breach sends an email
          or calls your webhook once, and the alert is recorded so it does not repeat. A Monday job sends the weekly margin report.
        </p>

        <h2 id="failure">When something fails</h2>
        <table>
          <thead>
            <tr>
              <th>Failure</th>
              <th>What happens</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>FiscaLLM is down</td><td>The SDK times out, retries once and drops the batch. Your app is unaffected; those events are missing.</td></tr>
            <tr><td>Duplicate delivery</td><td>Usage and webhook events are deduplicated by id. Safe to retry.</td></tr>
            <tr><td>Unknown model</td><td>Stored without a cost and flagged as unpriced. Add a price and it is counted going forward.</td></tr>
            <tr><td>User ID mismatch</td><td>Cost shows under free or unmatched; the match rate on Setup drops.</td></tr>
            <tr><td>Bad payload</td><td>The API rejects it with a 4xx and an error message; the SDK does not retry client errors.</td></tr>
            <tr><td>Hosted monthly limit reached</td><td>On the hosted service an app can send 100,000 events a month. After that the API answers 403 with a clear message until the 1st; the SDK prints it once. Self-hosted copies have no limit.</td></tr>
            <tr><td>You want reporting off</td><td>Set <code>FISCALLM_DISABLED=1</code> (or <code>disabled: true</code>). The SDK then does nothing at all: no events, no network calls, streams and responses pass through untouched.</td></tr>
            <tr><td>Stripe event it does not use, or non-USD</td><td>Acknowledged with 200 and ignored, so Stripe does not keep retrying. The response says why.</td></tr>
          </tbody>
        </table>

        <h2 id="data">What leaves your backend</h2>
        <p>
          A user ID, a model name, token or unit counts, an optional feature label and a timestamp. No prompts, no responses, no files. Each app&apos;s
          data is scoped by app ID and can be deleted in one click. See the <Link href="/privacy">privacy policy</Link>.
        </p>

        <h2 id="stack">Stack</h2>
        <p>
          TypeScript throughout: Next.js for the site and dashboard, Hono for the API, Postgres (Supabase) with Drizzle, hosted on Vercel. The
          TypeScript and Python SDKs have no dependencies and use only <code>fetch</code>.
        </p>

        <p className="mt-10">
          <Link href="/docs">Read the setup docs →</Link>
        </p>
      </Prose>
      <SiteFooter />
    </div>
  );
}
