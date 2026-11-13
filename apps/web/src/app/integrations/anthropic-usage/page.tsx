import type { Metadata } from "next";
import { SourceGuide } from "@/components/source-guide";

const TITLE = "Anthropic API usage per member and API key";
const PATH = "/integrations/anthropic-usage";
const DESCRIPTION =
  "Read your Claude Console organization's usage per member, API key, model and product (Messages API, Claude Code) with one Admin API key, priced at list prices. Free and open source.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const FAQ: [string, string][] = [
  [
    "Which plans can use this?",
    "Claude Console organizations with an Admin API key. Anthropic does not offer the Admin API on the claude.ai Team plan or to individual accounts; for Claude Code on those plans, use the Claude Code export.",
  ],
  [
    "Will Claude Code be counted twice?",
    "No. If Claude Code also sends its own export to the same FiscaLLM app, the Claude Code rows from the usage API are skipped.",
  ],
  [
    "How fresh is it?",
    "Anthropic refreshes the data about every four hours. FiscaLLM reads only hours that are refreshed, once a day and when you press Sync now.",
  ],
];

export default function Page() {
  return (
    <SourceGuide
      id="anthropic"
      title={TITLE}
      description={DESCRIPTION}
      path={PATH}
      faq={FAQ}
      intro={
        <>
          paste an Anthropic Admin API key on the Sources page. FiscaLLM reads your organization&apos;s usage hour by hour, per member or API key, model and
          product, and shows it next to your other AI tools.
        </>
      }
    />
  );
}
