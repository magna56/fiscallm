import type { Metadata } from "next";
import { CONTACT, Prose, SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = { title: "Terms · FiscaLLM" };

export default function TermsPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <Prose>
        <h1>Terms of service</h1>
        <p>Last updated: 17 October 2026</p>
        <p>By creating an account or sending data to FiscaLLM you agree to these terms. Contact: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>

        <h2>The service</h2>
        <p>
          FiscaLLM is in beta and free to use. Features may change, and we may introduce paid plans; we will tell you before anything you use
          starts to cost money.
        </p>

        <h2>Your responsibilities</h2>
        <ul>
          <li>Keep your ingest key secret, and replace it if it leaks.</li>
          <li>Have the right to send us the data you send, and tell your users about it in your own privacy policy.</li>
          <li>Do not send prompts, message content, names, emails or other contact details of your users.</li>
          <li>Do not abuse the service, overload it, or try to access other customers&apos; data.</li>
        </ul>

        <h2>Your data</h2>
        <p>
          You own the data you send. You let us process it to provide the service, as described in the <a href="/privacy">privacy policy</a>. You can
          delete it at any time.
        </p>

        <h2>Figures are estimates</h2>
        <p>
          Costs are calculated from published price lists and the usage you report, and revenue from what RevenueCat reports. They may differ from
          your provider and store invoices. Do not rely on them as accounting records.
        </p>

        <h2>No warranty</h2>
        <p>
          The service is provided &quot;as is&quot;, without warranties of any kind. To the extent the law allows, we are not liable for indirect or
          consequential losses, lost profits or lost data. The SDK is designed so that an outage of FiscaLLM does not affect your app.
        </p>

        <h2>Ending</h2>
        <p>
          You can stop using FiscaLLM and delete your data at any time. We may suspend accounts that break these terms, and will give notice before
          shutting down the service.
        </p>
      </Prose>
      <SiteFooter />
    </div>
  );
}
