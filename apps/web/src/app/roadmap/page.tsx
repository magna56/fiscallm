import type { Metadata } from "next";
import Link from "next/link";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = {
  title: "Roadmap · FiscaLLM",
  description: "What FiscaLLM stays free, what we are building next, and what we will only build if there is demand.",
  alternates: { canonical: "/roadmap" },
};

export default function RoadmapPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <Prose>
        <h1>Roadmap</h1>
        <p>
          FiscaLLM is open source and free. This is the plan, including what we will only build if there is real demand, so nobody is surprised later.
          Last updated: 18 October 2026. Shipped changes are in the <Link href="/changelog">changelog</Link>, and both live in the{" "}
          <a href="https://github.com/magna56/fiscallm">repo</a> too.
        </p>

        <h2>What is free, and stays free</h2>
        <ul>
          <li>The SDKs (TypeScript and Python), MIT licensed.</li>
          <li>The server, dashboard, alerts, weekly report, RevenueCat webhook and import, and the revenue API: open source, self-hostable for free.</li>
          <li>The hosted service at fiscallm.com is free under fair use (up to 100,000 events per app per month), run by the maintainer on a best-effort basis.</li>
        </ul>

        <h2>Done recently</h2>
        <ul>
          <li>Open source (MIT), self-hosting guide, contributing guide</li>
          <li>Kill switch in both SDKs</li>
          <li>CSV export of Users, Plans and Trials</li>
          <li>
            A page on <Link href="/coverage">what FiscaLLM covers and what it doesn&apos;t</Link>
          </li>
          <li>
            <strong>Price audit</strong> against the OpenAI, Anthropic and Google pricing pages (all matched; eight legacy OpenAI models added), plus a per-model
            CSV so you can check your own numbers
          </li>
          <li>
            <strong>Stripe connector (beta)</strong>: payments, trials and refunds from a Stripe webhook, USD only; tested against sample payloads, real-world
            reports welcome
          </li>
          <li>Optional monthly event cap per app</li>
          <li>Runnable examples (sample-data script, Next.js and FastAPI starting points) and a deploy-to-Vercel button</li>
          <li>Public roadmap and changelog pages</li>
        </ul>

        <h2>Next, in this order</h2>
        <ol>
          <li>
            <strong>Accuracy against real invoices</strong>: the price audit is done; a multi-week comparison with a real app&apos;s provider invoices still
            needs real usage
          </li>
          <li>
            <strong>Docker Compose</strong> for one-command self-hosting (waiting for a machine with Docker to test it properly; the Vercel button
            covers hosting meanwhile)
          </li>
        </ol>

        <h2>Later, only if there is demand</h2>
        <table>
          <thead>
            <tr>
              <th>Stage</th>
              <th>What we do</th>
              <th>Only when</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Signs of life</td>
              <td>Team accounts</td>
              <td>Any one: 300+ GitHub stars, 25+ active hosted apps, or 3+ people asking for it</td>
            </tr>
            <tr>
              <td>Paid cloud</td>
              <td>Optional paid plans for the hosted service (self-hosting stays free)</td>
              <td>10+ people say they would pay, or hosted usage outgrows the free fair-use limit</td>
            </tr>
            <tr>
              <td>Teams and companies</td>
              <td>SSO, audit logs, priority support</td>
              <td>Companies ask for them</td>
            </tr>
          </tbody>
        </table>
        <p>
          If we introduce paid hosted plans, existing free users get advance notice, and anything already in the open-source code stays open source.
        </p>

        <h2>Ideas, roughly in order</h2>
        <ul>
          <li>Budget enforcement: a check endpoint so your backend can ask &quot;may this user make another call?&quot; (only if people say they want protection, not just reports)</li>
          <li>Spread annual-plan revenue across the months it covers</li>
          <li>Slack and webhook alert channels</li>
          <li>Adapty and Superwall webhooks</li>
          <li>Hosted proxy for apps with no backend</li>
          <li>Direct App Store and Google Play connections</li>
          <li>Per-user cost forecasts and pricing advice</li>
        </ul>
        <p>
          Want something sooner? <a href="https://github.com/magna56/fiscallm/issues">Open an issue</a> and tell us the problem you have.
        </p>
      </Prose>
      <SiteFooter />
    </div>
  );
}
