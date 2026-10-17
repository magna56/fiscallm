import type { Metadata } from "next";
import Link from "next/link";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";

const TITLE = "How to track OpenAI cost per user";
const DESCRIPTION =
  "Your OpenAI bill shows tokens, not users. Read the usage object, price it, store it per user, and compare it with what each user pays. Code in TypeScript and Python.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/track-openai-cost-per-user" },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

const ARTICLE = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: TITLE,
  description: DESCRIPTION,
  author: { "@type": "Organization", name: "FiscaLLM" },
  publisher: { "@type": "Organization", name: "FiscaLLM", logo: { "@type": "ImageObject", url: "https://fiscallm.com/icon.svg" } },
  mainEntityOfPage: "https://fiscallm.com/guides/track-openai-cost-per-user",
};

export default function Guide() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ARTICLE) }} />
      <Prose>
        <p className="!mb-0 text-sm text-muted">
          <Link href="/guides">Guides</Link>
        </p>
        <h1>{TITLE}</h1>
        <p>
          <strong>In short:</strong> every OpenAI response tells you how many tokens it used. To get cost per user, read that usage, multiply it by
          the model&apos;s price, and add it to a running total keyed by your user ID. Then set it next to what that user pays you.
        </p>
        <p>
          The OpenAI dashboard shows spend by project, key and model, but not by <em>your</em> users. If you charge a flat subscription, that gap is
          where margin quietly disappears: one user can cost pennies and another can cost more than they pay.
        </p>

        <h2 id="usage">1. Read the usage object</h2>
        <p>
          Every non-streaming Chat Completions response includes a <code>usage</code> block. You only need three numbers from it, and you never need
          the message text.
        </p>
        <pre>
          <code>{`const res = await openai.chat.completions.create({ model, messages });

const u = res.usage;
// u.prompt_tokens                          input tokens (includes cached ones)
// u.prompt_tokens_details.cached_tokens    the part of the input served from cache
// u.completion_tokens                      output tokens (includes reasoning tokens)`}</code>
        </pre>
        <p>
          <strong>Streaming:</strong> a stream returns no usage unless you ask for it. Pass{" "}
          <code>stream_options: {"{ include_usage: true }"}</code> and read the final chunk, otherwise your streamed calls cost money and show up as
          zero.
        </p>

        <h2 id="price">2. Turn tokens into dollars</h2>
        <p>
          Providers publish prices per million tokens, with separate rates for input, cached input and output. The formula:
        </p>
        <pre>
          <code>{`cost = (prompt_tokens - cached) × input_rate
     +  cached                × cached_rate
     +  completion_tokens     × output_rate        (rates are USD per token = price ÷ 1,000,000)`}</code>
        </pre>
        <pre>
          <code>{`// Example rates only. Look up the current numbers on the provider's pricing page.
const PRICE_PER_MTOK = { "gpt-5-mini": { input: 0.25, cached: 0.025, output: 2.0 } };

function costUsd(model: string, u: Usage) {
  const p = PRICE_PER_MTOK[model];
  if (!p) return null; // unknown model: flag it, don't count it as $0
  const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
  return ((u.prompt_tokens - cached) * p.input + cached * p.cached + u.completion_tokens * p.output) / 1e6;
}`}</code>
        </pre>
        <p>Three mistakes that make the numbers wrong:</p>
        <ul>
          <li>
            <strong>Double-counting cached tokens.</strong> OpenAI&apos;s <code>prompt_tokens</code> already includes the cached ones, so subtract them
            before applying the input rate. Anthropic does the opposite: its <code>input_tokens</code> excludes cache reads and writes.
          </li>
          <li>
            <strong>Treating an unknown model as free.</strong> New models appear constantly. Store the event with no cost and flag it, so you notice.
          </li>
          <li>
            <strong>Using today&apos;s price for old usage.</strong> Prices change. Price each event when it happens and keep that number.
          </li>
        </ul>

        <h2 id="store">3. Store it per user</h2>
        <p>
          Write one row per call (with a unique event ID so a retry can&apos;t count twice) and roll it up per user per day. The daily rollup is what you
          query for dashboards; the raw rows are only for debugging, so you can delete them after a while.
        </p>
        <pre>
          <code>{`events(id uuid primary key, user_id, ts, model, input_tokens, cached_tokens, output_tokens, cost_usd, feature)
daily_user_cost(user_id, day, cost_usd, requests)   -- updated in the same transaction as the insert`}</code>
        </pre>
        <p>
          Do this off the request path (a queue, or <code>waitUntil</code> on serverless), so a database hiccup never slows or fails a user&apos;s AI call.
        </p>

        <h2 id="revenue">4. Compare it with what they pay</h2>
        <p>
          Cost alone isn&apos;t the answer. A user costing $8 a month is fine on a $30 plan and a loss on a $7.49 plan. You need revenue per user, net of
          store fees and tax, and the same user ID on both sides. If you sell through the App Store or Google Play, RevenueCat webhooks give you that.
        </p>
        <p>
          Then margin is simply <code>net revenue − AI cost</code> over the same window. Sort users by it, and the ones losing you money are at the top.
        </p>

        <h2 id="fiscallm">The shortcut: let FiscaLLM do steps 2 to 4</h2>
        <p>
          Steps 2 to 4 are the same for everyone, so we built them. One line after each call sends the model and token counts (never your prompts or
          answers). Prices, cached tokens, de-duplication, per-user rollups, revenue and alerts are handled.
        </p>
        <pre>
          <code>{`import { createMeter } from "fiscallm";
const meter = createMeter({ apiKey: process.env.FISCALLM_KEY, waitUntil });

const res = await openai.chat.completions.create({ model, messages });
meter.trackOpenAI(res, { userId, feature: "chat" });`}</code>
        </pre>
        <pre>
          <code>{`from fiscallm import Meter
meter = Meter(api_key=os.environ["FISCALLM_KEY"])

res = client.chat.completions.create(model=model, messages=messages)
meter.track_openai(res, user_id=user_id, feature="chat")`}</code>
        </pre>
        <p>
          It&apos;s free during the beta. <Link href="/demo">See the demo dashboard</Link> (no sign-up), read{" "}
          <Link href="/how-it-works">how it works</Link>, or <Link href="/login">start free</Link>.
        </p>

        <h2 id="faq">Questions</h2>
        <h3>Can the OpenAI dashboard show cost per user?</h3>
        <p>Not by your own users. It groups by project, API key and model. Some teams create one key per user, which doesn&apos;t scale; tracking usage in your own code does.</p>
        <h3>Does tracking slow my app down?</h3>
        <p>Not if you send events in the background and never await them on the request path.</p>
        <h3>Do I need to send prompts to track cost?</h3>
        <p>No. Cost depends only on the model and the token counts. Never send message content.</p>
      </Prose>
      <SiteFooter />
    </div>
  );
}
