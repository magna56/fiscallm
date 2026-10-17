import type { Metadata } from "next";
import { CONTACT, Prose, SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = { title: "Privacy · FiscaLLM" };

export default function PrivacyPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <Prose>
        <h1>Privacy policy</h1>
        <p>Last updated: 17 October 2026</p>
        <p>
          FiscaLLM helps app developers (&quot;customers&quot;) compare the AI cost of each of their users with the subscription revenue from that user.
          This policy explains what we collect, why, and what you can do about it. Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <h2>Data about customers</h2>
        <ul>
          <li>Your email address, to sign you in and to contact you about your account.</li>
          <li>The apps you create, their settings, and hashed ingest keys.</li>
        </ul>

        <h2>Data our customers send about their users</h2>
        <p>Customers&apos; backends and RevenueCat send us, for each of the customer&apos;s end users:</p>
        <ul>
          <li>
            <strong>A user identifier</strong> chosen by the customer, normally their RevenueCat app user ID, and the aliases RevenueCat reports for it.
          </li>
          <li>
            <strong>AI usage:</strong> time, provider, model, token counts, an optional cost and an optional feature label.
          </li>
          <li>
            <strong>Subscription events</strong> from RevenueCat: product, price, tax and store commission, store, purchase and expiry dates, and the
            raw event as RevenueCat sends it.
          </li>
        </ul>
        <p>
          <strong>We never receive prompts, AI responses or message content.</strong> The SDK sends token counts only. We do not ask for names, emails
          or other contact details of end users; customers should not send them as user identifiers.
        </p>
        <p>
          For this data, the customer decides what is collected and why, and we process it on their behalf to provide the service. End users with
          questions should contact the app developer, who can ask us to delete their data.
        </p>

        <h2>How we use it</h2>
        <ul>
          <li>To calculate and show cost, revenue and margin to the customer who sent it.</li>
          <li>To operate, secure and fix the service.</li>
        </ul>
        <p>We do not sell data, use it for advertising, or share one customer&apos;s data with another.</p>

        <h2>Retention and deletion</h2>
        <ul>
          <li>Raw AI usage events are deleted after 90 days. Daily cost totals per user and subscription events are kept while the app exists.</li>
          <li>Customers can delete all data of an app, or the app itself, at any time from its Settings page. Deletion is immediate.</li>
          <li>To delete your account, email us.</li>
        </ul>

        <h2>Service providers</h2>
        <ul>
          <li>Supabase: database and sign-in.</li>
          <li>Vercel: hosting.</li>
        </ul>
        <p>Data may be processed in the United States.</p>

        <h2>Security</h2>
        <p>
          Data is encrypted in transit. Ingest keys are stored only as hashes. Access to an app&apos;s data requires signing in as its owner.
        </p>

        <h2>Changes</h2>
        <p>We will post changes here and update the date above. For significant changes we will email customers.</p>
      </Prose>
      <SiteFooter />
    </div>
  );
}
