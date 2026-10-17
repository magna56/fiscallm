import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guide-shell";

const TITLE = "How to track Anthropic Claude cost per user";
const PATH = "/guides/track-anthropic-claude-cost-per-user";
const DESCRIPTION =
  "Anthropic's bill shows tokens, not your users. Read Claude's usage fields, price cache reads and writes correctly, handle streaming, and compare cost with what each user pays.";

export const metadata: Metadata = {
  title: `${TITLE} · FiscaLLM`,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { type: "article", title: TITLE, description: DESCRIPTION },
};

export default function Guide() {
  return (
    <GuideShell title={TITLE} description={DESCRIPTION} path={PATH}>
      <p>
        <strong>In short:</strong> every Claude response reports how many tokens it used. Read those numbers, price each kind at its own rate, add
        them to a total keyed by your user ID, and compare it with what that user pays you.
      </p>
      <p>
        The Anthropic console shows usage by workspace, key and model. It can&apos;t tell you which of <em>your</em> users caused it, which is the
        number you need when everyone pays the same flat price.
      </p>

      <h2 id="usage">1. Read the usage fields</h2>
      <p>
        A Messages API response has a <code>usage</code> object. Claude splits input into three separate counts, which matters for pricing:
      </p>
      <pre>
        <code>{`const message = await anthropic.messages.create({ model, max_tokens, messages });

const u = message.usage;
// u.input_tokens                  new input tokens (NOT including cache reads or writes)
// u.cache_read_input_tokens       input served from the prompt cache
// u.cache_creation_input_tokens   input written to the cache on this call
// u.output_tokens                 output tokens (includes extended-thinking tokens)`}</code>
      </pre>
      <p>
        <strong>Streaming:</strong> usage arrives in the stream events: input counts at the start and the final output count at the end. The SDK&apos;s
        helper that returns the final assembled message gives you the complete <code>usage</code> in one place, so use that instead of adding up
        events by hand.
      </p>

      <h2 id="price">2. Turn tokens into dollars</h2>
      <p>
        Anthropic publishes prices per million tokens. Cache reads are far cheaper than normal input, and cache writes cost a bit more than normal
        input, so each of the four counts gets its own rate:
      </p>
      <pre>
        <code>{`cost = input_tokens                 × input_rate
     + cache_read_input_tokens     × cache_read_rate
     + cache_creation_input_tokens × cache_write_rate
     + output_tokens               × output_rate      (rate = price per million ÷ 1,000,000)`}</code>
      </pre>
      <pre>
        <code>{`// Example rates only. Check the current numbers on Anthropic's pricing page.
const PRICE_PER_MTOK = { "claude-sonnet-5-5": { input: 3, cacheRead: 0.3, cacheWrite: 3.75, output: 15 } };

function costUsd(model: string, u: Anthropic.Usage) {
  const p = PRICE_PER_MTOK[model];
  if (!p) return null; // unknown model: flag it, don't count it as $0
  return (
    (u.input_tokens * p.input +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * p.cacheWrite +
      u.output_tokens * p.output) / 1e6
  );
}`}</code>
      </pre>
      <p>Mistakes that make Claude numbers wrong:</p>
      <ul>
        <li>
          <strong>Ignoring the cache fields.</strong> If you only sum <code>input_tokens</code> and <code>output_tokens</code>, you
          miss the cache costs entirely and under-count every call that wrote to the cache. Always include both cache counts.
        </li>
        <li>
          <strong>Treating thinking as free.</strong> Extended-thinking tokens are billed as output and are part of <code>output_tokens</code>. A user who
          triggers long reasoning can cost far more than the visible answer suggests.
        </li>
        <li>
          <strong>Mixing up the OpenAI convention.</strong> OpenAI&apos;s input count <em>includes</em> cached tokens; Claude&apos;s <em>excludes</em>{" "}
          them. Don&apos;t subtract cache reads from <code>input_tokens</code> here.
        </li>
        <li>
          <strong>Unpriced new models and old prices.</strong> Flag unknown models, and price each call at the time it happens so later price changes
          don&apos;t rewrite history.
        </li>
      </ul>

      <h2 id="store">3. Store it per user</h2>
      <p>
        Insert one row per call with a unique event ID (so a retry can&apos;t count twice) and keep a per-user, per-day rollup that dashboards read.
        Do the write off the request path so a database problem never slows or fails a Claude call.
      </p>
      <pre>
        <code>{`events(id uuid primary key, user_id, ts, model, input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, cost_usd, feature)
daily_user_cost(user_id, day, cost_usd, requests)`}</code>
      </pre>

      <h2 id="revenue">4. Compare it with what they pay</h2>
      <p>
        A user who costs $8 a month is fine on a $30 plan and a loss on a $7.49 plan. Bring in net revenue per user (after store fees and tax) under
        the same user ID, and margin is <code>net revenue − AI cost</code>. Sort by it and the users losing you money come first.
      </p>

      <h2 id="fiscallm">The shortcut</h2>
      <p>
        FiscaLLM does steps 2 to 4. One line after each call sends the model and the token counts, including the cache fields. It never reads the
        answer text or your prompts.
      </p>
      <pre>
        <code>{`import { createMeter } from "fiscallm";
const meter = createMeter({ apiKey: process.env.FISCALLM_KEY, waitUntil });

const message = await anthropic.messages.create({ model, max_tokens, messages });
meter.trackAnthropic(message, { userId, feature: "summary" });`}</code>
      </pre>
      <pre>
        <code>{`from fiscallm import Meter
meter = Meter(api_key=os.environ["FISCALLM_KEY"])

message = client.messages.create(model=model, max_tokens=1024, messages=messages)
meter.track_anthropic(message, user_id=user_id, feature="summary")`}</code>
      </pre>
      <p>
        Free and open source. <Link href="/demo">Try the demo dashboard</Link> (no sign-up), see <Link href="/how-it-works">how it works</Link>, or{" "}
        <Link href="/login">start free</Link>. Using OpenAI too? Read <Link href="/guides/track-openai-cost-per-user">the OpenAI version</Link>.
      </p>

      <h2 id="faq">Questions</h2>
      <h3>Can the Anthropic console show cost per user?</h3>
      <p>Not by your own users. It groups by workspace, API key and model. Per-user cost needs usage tracked in your own code.</p>
      <h3>Does prompt caching change how I track cost?</h3>
      <p>Yes. Cache reads and writes are billed at different rates from normal input, so they have to be counted separately.</p>
      <h3>Do I need to send prompts to track cost?</h3>
      <p>No. Cost depends only on the model and the token counts. Never send message content.</p>
    </GuideShell>
  );
}
