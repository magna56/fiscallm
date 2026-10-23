import type { Metadata } from "next";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = {
  title: "Changelog · FiscaLLM",
  description: "What changed in FiscaLLM and when.",
  alternates: { canonical: "/changelog" },
};

const ENTRIES: { date: string; items: string[] }[] = [
  {
    date: "2026-10-23",
    items: [
      "Connect RevenueCat: one click on the Setup page. Approve access in RevenueCat and FiscaLLM adds its webhook to your project and imports your past subscribers, with nothing to copy or paste. Read-only for customer data; Disconnect removes the webhook and the tokens.",
      "Caps that hold during an outage (SDKs 0.6.0): if FiscaLLM is slow or down, meter.check keeps refusing a user it already refused. New checkOnError: \"deny\" to fail closed, and localLimit to cap each user's calls, tokens or exact cost in your own process with no network call, so a runaway loop stops even when FiscaLLM is unreachable.",
      "Jobs, for pay-per-job apps (credits held, then charged or returned): tag AI calls with a jobId and report each job as pending, captured or refunded with meter.trackJob (TypeScript), meter.track_job (Python) or POST /api/v1/jobs. The new Jobs page shows the AI cost of refunded jobs and of jobs that never resolved, per user. SDKs 0.5.0.",
    ],
  },
  {
    date: "2026-10-19",
    items: [
      "Spending caps: mark a daily or 30-day per-user budget as Block, and call meter.check(userId) (TypeScript) or meter.check(user_id) (Python) before an AI call. It says no once the user reaches the amount, and fails open if FiscaLLM is slow or down. Also POST /api/v1/check. SDKs 0.4.0.",
      "Slack alerts: paste a Slack incoming-webhook URL as an alert's webhook.",
      "Runaway-loop alert: get alerted when one user uses more than N tokens in 5 minutes.",
    ],
  },
  {
    date: "2026-10-18",
    items: [
      "Kill switch in both SDKs (0.3.2): set FISCALLM_DISABLED=1, or pass disabled: true / disabled=True, and the SDK does nothing at all.",
      "A new Integrations page listing what FiscaLLM connects to, with a status for each. The How it works page now covers Stripe, the monthly limit and the kill switch.",
      "Accuracy: audited the built-in prices against the OpenAI, Anthropic and Google pricing pages (all matched), added eight legacy OpenAI models, and a per-model CSV export on Overview so you can compare with your provider.",
      "Stripe connector (beta): connect Stripe from the Setup page to count paid invoices, trials, cancellations and refunds. USD only; what you keep is estimated with Stripe's standard fee.",
      "Examples: a sample-data script that fills the dashboard without any AI key, Next.js and FastAPI starting points, and a Deploy-with-Vercel button.",
      "A public roadmap page, and this changelog page.",
      "CSV export of the Users, Plans and Trials tables.",
      "New page: what FiscaLLM covers and what it doesn't.",
      "The homepage dashboard preview is labelled “Sample data”.",
      "Optional monthly event cap per app. The hosted service uses 100,000; self-hosted copies have none by default.",
      "Email sender addresses are configurable for self-hosting.",
      "The project is open source (MIT), with a self-hosting guide, contributing guide and public roadmap.",
    ],
  },
  {
    date: "2026-10-17",
    items: [
      "Redesigned dashboard: sidebar, apps page and a guided setup checklist.",
      "Public demo dashboard on sample data, an engineering page, and guides on tracking OpenAI and Anthropic cost per user and AI margin per user for RevenueCat apps.",
      "Sign-in links point at fiscallm.com and work from any browser.",
      "Web analytics for public pages only, without cookies.",
    ],
  },
  {
    date: "Earlier in October 2026",
    items: [
      "Revenue API for apps without RevenueCat (trackRevenue / track_revenue).",
      "Python SDK and an AI setup skill.",
      "Budgets and alerts, a weekly margin report by email, and RevenueCat history import.",
      "Per-unit pricing for image, audio and video models.",
      "First version: ingest API, RevenueCat webhook, per-user, plan and trial margin dashboard, TypeScript SDK.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <Prose>
        <h1>Changelog</h1>
        <p>
          What changed and when, newest first. The same list is in <a href="https://github.com/magna56/fiscallm/blob/main/CHANGELOG.md">CHANGELOG.md</a> in the
          repo.
        </p>
        {ENTRIES.map((e) => (
          <section key={e.date}>
            <h2>{e.date}</h2>
            <ul>
              {e.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
        ))}
      </Prose>
      <SiteFooter />
    </div>
  );
}
