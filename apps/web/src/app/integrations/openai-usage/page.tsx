import type { Metadata } from "next";
import { SourceGuide } from "@/components/source-guide";

const TITLE = "OpenAI API usage per member and API key";
const PATH = "/integrations/openai-usage";
const DESCRIPTION =
  "Read your OpenAI organization's usage (chat, embeddings, Whisper and text to speech) per member, API key and model with one admin key, priced at list prices. No code change. Free and open source.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const FAQ: [string, string][] = [
  [
    "Which key is needed?",
    "An admin key (sk-admin-…), which only organization owners can create. FiscaLLM uses it to read the Usage API and the member list; it never calls a model with it.",
  ],
  [
    "Is this cost per end user of my product?",
    "No. OpenAI knows members and API keys, not your users. For cost per end user, add the FiscaLLM SDK, OpenTelemetry or LiteLLM as well.",
  ],
  [
    "Does it match my OpenAI invoice?",
    "Closely but not exactly: usage is priced at list prices, so discounts, Batch and Flex pricing and image generation are not reflected.",
  ],
];

export default function Page() {
  return (
    <SourceGuide
      id="openai"
      title={TITLE}
      description={DESCRIPTION}
      path={PATH}
      faq={FAQ}
      intro={
        <>
          paste an OpenAI admin key on the Sources page. FiscaLLM reads your organization&apos;s usage hour by hour, per member, API key and model, and shows it
          next to your other AI tools.
        </>
      }
    />
  );
}
