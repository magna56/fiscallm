import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";
import { messageCost, popularModels, usd } from "@/lib/models";

const TITLE = "7 ways to cut LLM cost per user without making your app worse";
const PATH = "/guides/cut-llm-cost-per-user";
const DESCRIPTION =
  "Prompt caching, trimming history, shorter replies, routing easy requests to a cheaper model and more: what each saves on OpenAI, Claude and Gemini, and how to check it worked per user.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  keywords: ["reduce LLM cost", "reduce OpenAI API cost", "prompt caching savings", "cheaper LLM per user", "LLM cost optimization"],
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const rows = popularModels()
  .filter((m) => m.price.cached !== undefined && m.price.cached < m.price.input)
  .map((m) => ({ m, none: messageCost(m.price), half: messageCost(m.price, { cachedShare: 0.5 }), most: messageCost(m.price, { cachedShare: 0.9 }) }))
  .slice(0, 8);

const FAQ: [string, string][] = [
  [
    "What saves the most?",
    "Usually the model choice, then prompt caching. Moving easy requests to a smaller model can cut their cost by 5 to 20 times; caching a long, stable system prompt cuts the input part by up to 90% on providers that discount cached tokens.",
  ],
  [
    "How do I know a change actually saved money?",
    "Compare AI cost per user before and after, not total spend, which also moves with the number of users. FiscaLLM shows cost per user by model and feature, so the effect of each change is visible.",
  ],
];

export default function Guide() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH} faq={FAQ}>
      <p>
        <strong>In short:</strong> put the stable part of the prompt first so it is cached, stop resending the whole chat history, cap reply length,
        and send easy requests to a smaller model. Together these often cut cost per user by half or more. Then measure cost per user, not total
        spend, to see what worked.
      </p>

      <h2 id="1">1. Use prompt caching</h2>
      <p>
        Providers charge much less for prompt tokens they have seen recently. Keep the system prompt, tools and instructions identical and at the
        start of every request so they hit the cache. Cost per message (1,500-token prompt, 400-token reply):
      </p>
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>No cache</th>
            <th>Half cached</th>
            <th>90% cached</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, none, half, most }) => (
            <tr key={m.slug}>
              <td>
                <Link href={`/llm-pricing/${m.slug}`}>{m.name}</Link>
              </td>
              <td>{usd(none)}</td>
              <td>{usd(half)}</td>
              <td>{usd(most)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 id="2">2. Trim or summarize chat history</h2>
      <p>Every turn resends the conversation. Keep the last few turns verbatim and replace older ones with a short summary.</p>

      <h2 id="3">3. Cap reply length</h2>
      <p>Output tokens cost several times more than input. Set <code>max_tokens</code> per feature and ask for concise answers where it fits.</p>

      <h2 id="4">4. Route easy requests to a smaller model</h2>
      <p>
        Classification, short rewrites and extraction rarely need a frontier model. Compare prices on the <Link href="/llm-pricing">LLM pricing
        page</Link> and test quality on real requests before switching.
      </p>

      <h2 id="5">5. Do not call the model when you do not need to</h2>
      <p>Cache identical answers, debounce typing-triggered calls, and skip AI for inputs a rule can handle.</p>

      <h2 id="6">6. Give each plan an allowance</h2>
      <p>
        The heaviest few users can cost more than everyone else together. A limit per plan caps them:{" "}
        <Link href="/guides/ai-usage-limits-by-plan">how to limit AI usage per plan</Link>, with numbers from the{" "}
        <Link href="/pricing-planner">pricing planner</Link>.
      </p>

      <h2 id="7">7. Measure per user and per feature</h2>
      <p>
        Total spend hides where the money goes. Tag each AI call with the user and the feature, and look at cost per user over time. FiscaLLM does
        this with one line per call, free and open source: <Link href="/demo">see the demo</Link>.
      </p>
    </GuideShell>
  );
}
