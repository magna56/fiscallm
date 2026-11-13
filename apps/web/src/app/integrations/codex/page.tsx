import type { Metadata } from "next";
import { SourceGuide } from "@/components/source-guide";

const TITLE = "Codex CLI spend per developer";
const PATH = "/integrations/codex";
const DESCRIPTION =
  "See what each developer spends in OpenAI's Codex CLI, per model, from its built-in OpenTelemetry export. Five lines in config.toml, no proxy, prompts never stored. Free and open source.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const FAQ: [string, string][] = [
  [
    "How does FiscaLLM get Codex usage?",
    "Codex CLI has an OpenTelemetry exporter built in. With [otel.exporter.otlp-http] pointed at FiscaLLM, it sends an event for each completed model response with its token counts. FiscaLLM reads only those events.",
  ],
  [
    "Codex does not send a cost. How is it priced?",
    "From the tokens: uncached input, cached input and output (reasoning included), at OpenAI's API list prices for the model, such as gpt-5.3-codex.",
  ],
  [
    "We use Codex with ChatGPT plans, not API keys. Is the number a bill?",
    "No. On a ChatGPT plan the amount is what the same usage would cost at API prices. It still shows who uses Codex most and with which models.",
  ],
  [
    "Who is each call attributed to?",
    "The signed-in ChatGPT account's email. With an API key there is no account, so the machine's host name is used; set fiscallm.user_id as a resource attribute to name the developer yourself.",
  ],
];

export default function Page() {
  return (
    <SourceGuide
      id="codex"
      title={TITLE}
      description={DESCRIPTION}
      path={PATH}
      faq={FAQ}
      intro={
        <>
          add an OTLP exporter to <code>~/.codex/config.toml</code> that posts to FiscaLLM. Each completed Codex response becomes a cost event for the developer
          who ran it, next to Claude Code, Cursor and the rest of your AI tools.
        </>
      }
    />
  );
}
