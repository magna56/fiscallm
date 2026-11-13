import type { Metadata } from "next";
import { SourceGuide } from "@/components/source-guide";

const TITLE = "Gemini CLI spend per developer";
const PATH = "/integrations/gemini-cli";
const DESCRIPTION =
  "See what each developer spends in Google's Gemini CLI, per model, from its built-in OpenTelemetry telemetry. One block in settings.json, no collector, prompts never stored. Free and open source.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const FAQ: [string, string][] = [
  [
    "Do I need an OpenTelemetry Collector or Google Cloud?",
    'No. With "target": "local" and "otlpProtocol": "http", Gemini CLI posts its telemetry straight to FiscaLLM. Nothing goes to Google Cloud.',
  ],
  [
    "How is the cost worked out?",
    "From the token counts of each API response: uncached input, cached content, output and thinking tokens, at Google's API list prices for the model.",
  ],
  [
    "Are prompts sent?",
    'Set "logPrompts": false, as in the settings above. Even when prompts are sent, FiscaLLM reads only the token counts of the gemini_cli.api_response event.',
  ],
  [
    "Is anything counted twice?",
    "No. Gemini CLI reports each call twice, once as gemini_cli.api_response and once in the GenAI conventions; only the first is read.",
  ],
];

export default function Page() {
  return (
    <SourceGuide
      id="gemini-cli"
      title={TITLE}
      description={DESCRIPTION}
      path={PATH}
      faq={FAQ}
      intro={
        <>
          turn on telemetry in <code>~/.gemini/settings.json</code> with FiscaLLM as the OTLP endpoint. Each Gemini API response becomes a cost event for the
          developer, next to your other AI tools.
        </>
      }
    />
  );
}
