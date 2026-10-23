import type { Metadata } from "next";
import Link from "next/link";
import { Prose, SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = {
  title: "What FiscaLLM covers (and what it doesn't) · FiscaLLM",
  description:
    "An honest list of what FiscaLLM measures correctly, what you have to handle yourself, and what it does not do: providers, streaming, caching, agents, retries, pricing accuracy and revenue sources.",
  alternates: { canonical: "/coverage" },
};

export default function CoveragePage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <Prose>
        <h1>What FiscaLLM covers, and what it doesn&apos;t</h1>
        <p>
          <strong>In short:</strong> FiscaLLM adds up the cost of every AI call you report for each user, and sets it next to what that user pays.
          It is only as complete as what you report. This page lists what is handled for you, what you must do yourself, and what is out of scope,
          so you can judge whether it fits before you install it.
        </p>

        <h2 id="calls">AI calls</h2>
        <h3>Handled for you</h3>
        <ul>
          <li>
            <strong>Helpers</strong> for OpenAI (Chat Completions and Responses), Anthropic (Messages) and Gemini (<code>generateContent</code>). They read
            only the model name and the token counts from the response.
          </li>
          <li>
            <strong>OpenAI-compatible APIs</strong> (Groq, OpenRouter, DeepSeek, Together and similar) through the same helper with a provider name.
          </li>
          <li>
            <strong>Streaming</strong>: <code>trackStream</code> for SDK streams and <code>trackSSE</code> for raw <code>fetch</code> streams. OpenAI Chat
            Completions streams need <code>stream_options: {"{ include_usage: true }"}</code>, otherwise there is no usage to read, and the SDK says so once.
          </li>
          <li>
            <strong>Non-token usage</strong>: images, seconds of video, minutes of audio and characters of speech, with price variants such as a
            resolution.
          </li>
          <li>
            <strong>Reasoning and thinking tokens</strong> are part of the output tokens the providers report, so they are counted.
          </li>
          <li>
            <strong>Embeddings</strong> responses are read the same way (input tokens only).
          </li>
        </ul>
        <h3>You have to handle</h3>
        <ul>
          <li>
            <strong>Agents and tool loops.</strong> FiscaLLM records one event per call you report. If one user action makes five model calls, report all
            five with the same <code>userId</code> (use <code>feature</code> to group them). Calls you do not report are not counted.
          </li>
          <li>
            <strong>Retries.</strong> If a retry or a failed attempt is billed by the provider, report each attempt that returned usage. FiscaLLM
            de-duplicates only repeated delivery of the same event (the SDK&apos;s retry of its own upload), never two separate calls.
          </li>
          <li>
            <strong>Calls that fail without a usage block.</strong> If the provider still bills for them, they are an undercount we cannot see.
          </li>
          <li>
            <strong>Other languages.</strong> There are TypeScript and Python SDKs. Anything else can use the HTTP API.
          </li>
          <li>
            <strong>A backend.</strong> It needs a server between your app and the provider. Apps that call a provider straight from the phone are not covered.
          </li>
        </ul>

        <h2 id="pricing">Pricing and accuracy</h2>
        <ul>
          <li>
            Cost is <strong>token counts × list prices</strong>, with separate rates for input, cached input, cache writes and output, and higher-price tiers
            for long prompts where the provider has them.
          </li>
          <li>
            The built-in price table covers 100+ models from OpenAI, Anthropic and Google, including speech, image and video models. It is maintained by
            hand. Each price has an effective date, so changing a price never rewrites history.
          </li>
          <li>
            <strong>Models without a price</strong> (other providers, new releases, embedding models) are stored and shown as <strong>unpriced</strong>, never
            as $0. You can pass an exact <code>costUsd</code>, or set your own price or a percentage discount in Settings.
          </li>
          <li>
            <strong>It does not read your invoice.</strong> Expect small differences from things we cannot see: batch discounts, committed-use or enterprise
            discounts, regional pricing, free credits and taxes. Set a discount in Settings if you have one.
          </li>
          <li>
            <strong>Not applied:</strong> batch and fast-tier prices, regional or US-only uplifts (about +10%), Anthropic 1-hour cache writes (priced as 5-minute
            writes) and promotional prices.
          </li>
          <li>
            On 18 October 2026 we checked the built-in prices against the providers&apos; pricing pages (OpenAI, Anthropic, Google text models): they matched,
            and eight legacy OpenAI models were added. Details and how to check your own numbers:{" "}
            <a href="https://github.com/magna56/fiscallm/blob/main/ACCURACY.md">ACCURACY.md</a>. A comparison against real invoices over several weeks is
            not published yet, so please check the first week of numbers against your provider&apos;s usage page. Overview has a &quot;Download CSV&quot; on cost by
            model for that.
          </li>
        </ul>

        <h2 id="revenue">Revenue</h2>
        <ul>
          <li>
            <strong>RevenueCat</strong> through a webhook: purchases, renewals, trials, refunds, cancellations, expirations, plan changes and user ID
            aliases. Revenue is counted net of store fees and tax. Past subscribers can be imported once.
          </li>
          <li>
            <strong>Stripe (beta)</strong> through a webhook: paid invoices, trials, auto-renew switched off, ended subscriptions and refunds. USD only,
            and what you keep is estimated with Stripe&apos;s standard fee, not read from Stripe. Tested against sample payloads, not yet against many real
            accounts.
          </li>
          <li>
            <strong>Any other billing system</strong> (your own App Store or Play server notifications, Paddle and so on) through the revenue API, one call
            per payment, refund or cancellation.
          </li>
          <li>
            <strong>Not built yet:</strong> direct App Store and Google Play connections, and non-USD currencies.
          </li>
          <li>
            <strong>Annual plans</strong> are counted when the payment arrives, so a user can look very profitable in the month they paid and the opposite
            afterwards. View annual users over 90 days or more.
          </li>
          <li>
            Amounts are in USD. Users with AI cost and no subscription are shown as <strong>free or unmatched</strong>, which is expected for free users.
          </li>
        </ul>

        <h2 id="not">What it does not do</h2>
        <ul>
          <li>It never reads, stores or sends prompts, responses or any message content.</li>
          <li>It is not an observability tool: no traces, latency, evaluations or prompt management. Tools like Langfuse and Helicone do that.</li>
          <li>
            It blocks nothing by itself. Alerts only report. To refuse a user over budget, mark the budget as Block and call <code>meter.check</code> in your
            backend. It is based on cost already recorded, so a user can go slightly over before being refused. If FiscaLLM is unreachable, users it
            already refused stay refused and others are allowed unless you choose to fail closed. Automatic downgrade to a cheaper model is on the roadmap.
          </li>
          <li>Hosted use is limited to 100,000 events per app per month. Self-hosting has no limit.</li>
        </ul>

        <h2 id="reliability">Reliability</h2>
        <ul>
          <li>The SDK never throws and never waits on the network on your request path. It batches in the background and retries once.</li>
          <li>If FiscaLLM is unreachable, those events are dropped and your app is unaffected.</li>
          <li>
            <strong>Kill switch:</strong> set the environment variable <code>FISCALLM_DISABLED=1</code> (or pass <code>disabled: true</code> /{" "}
            <code>disabled=True</code>) and the SDK does nothing at all: no events, no network calls, streams and responses pass through untouched.
          </li>
          <li>You can delete all of an app&apos;s data in one click, and self-host if you prefer to keep everything on your own servers.</li>
        </ul>

        <p className="mt-10">
          Found something that is wrong or missing? <a href="https://github.com/magna56/fiscallm/issues">Open an issue</a>. See{" "}
          <Link href="/how-it-works">how it works</Link> and the <Link href="/docs">docs</Link>.
        </p>
      </Prose>
      <SiteFooter />
    </div>
  );
}
