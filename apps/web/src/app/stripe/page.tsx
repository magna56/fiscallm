import type { Metadata } from "next";
import Link from "next/link";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";
import { COMPETITORS, FISCALLM } from "@/lib/compare";

const TITLE = "Stripe AI margin per customer: OpenAI, Claude and Gemini cost against Stripe revenue";
const DESCRIPTION =
  "Connect Stripe to FiscaLLM and see each customer's AI cost next to what they paid: Stripe's exact fee, any currency, refunds, lost disputes, trials and 12 months of history. Free and open source.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: "/stripe" },
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION },
};

const EVENTS: [string, string][] = [
  ["invoice.paid", "A payment: first payment, renewal, or the conversion after a free trial"],
  ["customer.subscription.created", "A free trial starts: AI cost begins, revenue is $0"],
  ["customer.subscription.updated", "Auto-renew switched off counts as a cancellation"],
  ["customer.subscription.deleted", "The subscription ended"],
  ["charge.refunded", "Only the new part of each refund is subtracted, so partial refunds are never counted twice"],
  ["charge.dispute.closed", "A lost dispute (chargeback) is subtracted like a refund; a won one changes nothing"],
];

const FAQ: [string, string][] = [
  [
    "Does Stripe show AI cost per customer?",
    "No. Stripe knows what each customer paid, not what their usage cost you at OpenAI, Anthropic or Google. FiscaLLM records AI cost per user from your backend and joins it to Stripe payments by user ID.",
  ],
  [
    "How does FiscaLLM know which Stripe customer is which user?",
    "Set metadata.user_id on the Stripe subscription or customer to the same user ID your backend sends with AI usage. Without it, the Stripe customer ID is used, so you can also report AI usage under the cus_ ID.",
  ],
  [
    "Is the Stripe fee exact?",
    "With a saved read-only restricted key, yes: FiscaLLM reads the fee and the settled USD amount from Stripe's balance transaction. Without a key it estimates the standard 2.9% + $0.30 and counts USD payments only.",
  ],
  [
    "Does it handle other currencies?",
    "Yes, with a saved read-only key: a payment in EUR, GBP or any other currency counts at the USD amount Stripe actually settled. Refunds and disputes use the same rate as the payment.",
  ],
  [
    "Are chargebacks counted?",
    "Lost disputes are subtracted like refunds, against the same payment, so a refund and a dispute on one charge are never counted twice. Won disputes change nothing. Tracing a dispute back to its customer needs the read-only key.",
  ],
  [
    "Can it import past Stripe payments?",
    "Yes. Paste a read-only restricted key to import the last 12 months of paid invoices, refunds, current trials and ended subscriptions. An invoice is counted once whether it arrives by webhook or import, so re-running is safe.",
  ],
  [
    "What does it cost?",
    "Nothing. FiscaLLM is free and open source (MIT). Use the hosted service at fiscallm.com or self-host it so your revenue data never leaves your servers.",
  ],
];

const RIVALS = ["margindash", "marginmeter", "weckr"].map((s) => COMPETITORS.find((c) => c.slug === s)!);

export default function StripePage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "FiscaLLM",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://fiscallm.com/stripe",
      description: DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      license: "https://opensource.org/licenses/MIT",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Prose>
        <p className="!mb-0 text-sm text-muted">
          <Link href="/integrations">Integrations</Link>
        </p>
        <h1>AI margin per customer for apps that bill with Stripe</h1>
        <p>
          <strong>In short:</strong> FiscaLLM reads your Stripe payments and puts them next to what each customer costs you in OpenAI, Anthropic and
          Gemini tokens. You see which customers are profitable, which plans and trials lose money, and get an alert when a paying customer starts
          costing more than they pay. Free and open source (MIT).
        </p>

        <h2 id="what">What it counts</h2>
        <table>
          <thead>
            <tr>
              <th>Stripe event</th>
              <th>What happens in FiscaLLM</th>
            </tr>
          </thead>
          <tbody>
            {EVENTS.map(([e, what]) => (
              <tr key={e}>
                <td>
                  <code>{e}</code>
                </td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          What you keep is the payment minus tax minus Stripe&apos;s fee. Save a read-only restricted key and the fee is Stripe&apos;s <em>exact</em> fee
          from the balance transaction, and payments in any currency count at the USD amount Stripe settled. Without a key the fee is estimated
          (2.9% + $0.30) and only USD counts. Plan changes mid-cycle use the subscription line, not proration lines, and tax is read on every Stripe
          API version.
        </p>

        <h2 id="setup">Set up in three steps</h2>
        <ol>
          <li>
            <strong>Tag users.</strong> Put your user ID on the subscription: <code>subscription_data: {"{ metadata: { user_id } }"}</code> at
            checkout. Report AI usage under the same ID with one line per call, for example <code>meter.trackOpenAI(res, {"{ userId }"})</code>.
          </li>
          <li>
            <strong>Connect the webhook.</strong> Add the webhook URL from your app&apos;s Setup page in Stripe and paste its signing secret. Every
            request is verified, and retries are counted once.
          </li>
          <li>
            <strong>Optional: add a read-only key.</strong> Import the last 12 months of history, and get exact fees, other currencies and lost
            disputes. The key can only read.
          </li>
        </ol>
        <p>
          Tested end to end against Stripe test clocks: a trial that converts and renews, a partial refund, two lost disputes and a cancellation,
          checked to the cent. Step-by-step details are in <Link href="/docs#stripe">the Stripe docs</Link>, and the reasoning behind each number in{" "}
          <Link href="/guides/ai-cost-per-customer-stripe">how to track AI cost per customer against Stripe revenue</Link>.
        </p>

        <h2 id="compare">How it compares</h2>
        <table>
          <thead>
            <tr>
              <th>Tool</th>
              <th>Price</th>
              <th>Open source</th>
              <th>Stripe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-medium">FiscaLLM</td>
              <td>Free</td>
              <td>{FISCALLM.openSource}</td>
              <td>{FISCALLM.stripe}</td>
            </tr>
            {RIVALS.map((c) => (
              <tr key={c.slug}>
                <td className="font-medium">
                  <Link href={`/compare/fiscallm-vs-${c.slug}`}>{c.name}</Link>
                </td>
                <td>{c.pricing}</td>
                <td>{c.openSource}</td>
                <td>{c.stripe}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Not on Stripe? FiscaLLM also connects <Link href="/guides/ai-margin-per-user-revenuecat">RevenueCat</Link> in one click, takes a{" "}
          <Link href="/guides/ai-margin-from-revenue-csv">revenue CSV</Link> from Paddle or Lemon Squeezy, or any billing system through{" "}
          <Link href="/docs#revenue-api">the revenue API</Link>.
        </p>
        <p>
          <Link href="/demo">Open the demo dashboard</Link> (sample data, no sign-up) or <Link href="/login">start free</Link>.
        </p>

        <h2 id="faq">Questions</h2>
        {FAQ.map(([q, a]) => (
          <div key={q}>
            <h3>{q}</h3>
            <p>{a}</p>
          </div>
        ))}
      </Prose>
      <SiteFooter />
    </div>
  );
}
