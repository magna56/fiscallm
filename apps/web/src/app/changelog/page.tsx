import type { Metadata } from "next";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = {
  title: "Changelog · FiscaLLM",
  description: "What changed in FiscaLLM and when.",
  alternates: { canonical: "/changelog" },
};

const ENTRIES: { date: string; items: string[] }[] = [
  {
    date: "2026-10-18",
    items: [
      "Kill switch in both SDKs (0.3.2): set FISCALLM_DISABLED=1, or pass disabled: true / disabled=True, and the SDK does nothing at all.",
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
