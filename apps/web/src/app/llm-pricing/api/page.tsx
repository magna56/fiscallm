import { PRICES_CHECKED } from "@fiscallm/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";
import { TEXT_MODELS } from "@/lib/models";

const TITLE = "Free LLM pricing API";
const PATH = "/llm-pricing/api";
const DESCRIPTION =
  "A free JSON API for current OpenAI, Anthropic and Google model prices, plus a cost estimate endpoint. No key, no sign-up, CORS enabled. Also available as an MCP server.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const FAQ: [string, string][] = [
  [
    "Is the LLM pricing API free?",
    "Yes. No key and no sign-up. Answers are cached for an hour, so please cache on your side too rather than calling it on every request.",
  ],
  [
    "Where do the prices come from?",
    "From FiscaLLM's open-source price table (MIT), checked against the OpenAI, Anthropic and Google pricing pages. Every answer includes the date of the last check.",
  ],
  [
    "Which prices are these?",
    "List prices in USD per million tokens, standard tier. Batch discounts, priority tiers and negotiated rates are not included.",
  ],
  [
    "Can I call it from a browser?",
    "Yes. Every endpoint sends Access-Control-Allow-Origin: *.",
  ],
  [
    "How do I get the cost of my own app's calls per user?",
    "That is what FiscaLLM itself does: send usage from your backend and it prices each call and adds it up per user, next to revenue.",
  ],
];

export default function Page() {
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "LLM API prices",
    description: `List prices per million tokens for ${TEXT_MODELS.length} OpenAI, Anthropic and Google text models, with cached-input and long-context rates.`,
    url: `https://fiscallm.com${PATH}`,
    license: "https://opensource.org/licenses/MIT",
    isAccessibleForFree: true,
    dateModified: PRICES_CHECKED,
    creator: { "@type": "Organization", name: "FiscaLLM", url: "https://fiscallm.com" },
    distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: "https://fiscallm.com/api/v1/prices" }],
  };
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} crumb={{ href: "/llm-pricing", label: "LLM pricing" }} faq={FAQ}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }} />
      <p>
        <strong>In short:</strong> <code>GET https://fiscallm.com/api/v1/prices</code> returns the current list price of every model in{" "}
        <Link href="/llm-pricing">our price table</Link> as JSON. No key. Prices were last checked on {PRICES_CHECKED}.
      </p>

      <h2 id="list">List prices</h2>
      <pre>
        <code>{`curl "https://fiscallm.com/api/v1/prices?provider=anthropic&q=haiku"`}</code>
      </pre>
      <p>
        Both filters are optional: <code>provider</code> is <code>openai</code>, <code>anthropic</code> or <code>google</code>, and <code>q</code> matches
        part of a model ID. The answer has <code>count</code> and <code>models</code>, plus the currency, unit and the date of the last check.
      </p>

      <h2 id="one">One model</h2>
      <pre>
        <code>{`curl https://fiscallm.com/api/v1/prices/claude-sonnet-4-5

{
  "currency": "USD",
  "unit": "per 1,000,000 tokens (unitPrices are per image, second, minute or character)",
  "tier": "list price, standard tier",
  "checked": "${PRICES_CHECKED}",
  "source": "https://fiscallm.com/llm-pricing",
  "audit": "https://github.com/magna56/fiscallm/blob/main/ACCURACY.md",
  "license": "MIT",
  "model": {
    "id": "claude-sonnet-4-5",
    "provider": "anthropic",
    "inputPerMtok": 3,
    "outputPerMtok": 15,
    "cachedInputPerMtok": 0.3,
    "cacheWritePerMtok": 3.75,
    "url": "https://fiscallm.com/llm-pricing/claude-sonnet-4-5"
  }
}`}</code>
      </pre>
      <p>
        Dated IDs and provider prefixes resolve to the same model, so <code>openai/gpt-4o-mini</code> works. Where they apply, a model also has{" "}
        <code>longContext</code> (the rate above a prompt size), <code>unitPrices</code> (images, audio, video) and <code>next</code> (an announced price
        change and its date). An unknown model returns <code>404</code>.
      </p>

      <h2 id="estimate">Estimate a call</h2>
      <pre>
        <code>{`curl "https://fiscallm.com/api/v1/estimate?model=gpt-4o-mini&input=1500&output=400&cached=1000&calls=300"

{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "costUsd": 0.00039,
  "calls": 300,
  "totalUsd": 0.117,
  "inputTokens": 1500,
  "outputTokens": 400,
  "cachedTokens": 1000,
  "cacheWriteTokens": 0,
  "currency": "USD",
  "checked": "${PRICES_CHECKED}"
}`}</code>
      </pre>
      <table>
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>model</code>
            </td>
            <td>Model ID (required)</td>
          </tr>
          <tr>
            <td>
              <code>input</code>
            </td>
            <td>Prompt tokens per call, including any cached ones</td>
          </tr>
          <tr>
            <td>
              <code>output</code>
            </td>
            <td>Reply tokens per call</td>
          </tr>
          <tr>
            <td>
              <code>cached</code>
            </td>
            <td>How many of the prompt tokens are read from the prompt cache</td>
          </tr>
          <tr>
            <td>
              <code>cache_write</code>
            </td>
            <td>Prompt tokens written to the cache (Anthropic)</td>
          </tr>
          <tr>
            <td>
              <code>calls</code>
            </td>
            <td>Number of calls like this one; default 1</td>
          </tr>
        </tbody>
      </table>

      <h2 id="npm">As an npm package</h2>
      <p>
        The same table ships in the <code>fiscallm</code> package (0.7.0 and later, MIT, no dependencies) for code that should not make a network
        call. It is as current as the version you installed; this API is always current.
      </p>
      <pre>
        <code>{`import { estimateCost, listPrices, priceOf } from "fiscallm/prices";

priceOf("openai/gpt-4o");        // USD per 1M tokens: { input: 2.5, cached: 1.25, output: 10, … }
estimateCost({ model: "claude-sonnet-4-5", inputTokens: 12_000, outputTokens: 800, cachedTokens: 10_000 });
listPrices();                    // every current text model, cheapest input first`}</code>
      </pre>

      <h2 id="agents">For AI agents</h2>
      <p>
        The same data is available to assistants as tools through the <Link href="/mcp">FiscaLLM MCP server</Link> at{" "}
        <code>https://fiscallm.com/api/mcp</code>, which adds model comparison and subscription break-even. The API is described in{" "}
        <a href="/openapi.json">openapi.json</a>.
      </p>

      <h2 id="more">From list price to your real cost</h2>
      <p>
        A price table tells you what a call costs. It does not tell you which of your users cost more than they pay. FiscaLLM adds up real usage per
        user and sets it next to revenue. <Link href="/demo">See the demo</Link> or read <Link href="/how-it-works">how it works</Link>.
      </p>
    </GuideShell>
  );
}
