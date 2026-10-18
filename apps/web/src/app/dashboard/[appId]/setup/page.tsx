import { eventsThisMonth, monthlyEventCap, nextMonthStart } from "@fiscallm/shared/limits";
import { schema } from "@fiscallm/shared";
import { lastDays, overview } from "@fiscallm/shared/metrics";
import { and, desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { AiSetup } from "@/components/ai-setup";
import { AutoRefresh } from "@/components/auto-refresh";
import { CopyButton, CopyField } from "@/components/copy-button";
import { Button, Card, Code, Input, Notice, PageHeader, pct } from "@/components/ui";
import { SetupChecklist } from "@/components/setup-checklist";
import { setupState } from "@/lib/setup-state";
import { requireApp } from "@/lib/auth";
import { getDb, metricsDb } from "@/lib/db";
import { keyCookie } from "@/lib/key-cookie";
import { origin } from "@/lib/origin";
import { connectStripe, disconnectStripe, dismissKey, rotateKey } from "../../actions";

export default function SetupPage({ params, searchParams }: PageProps<"/dashboard/[appId]/setup">) {
  return (
    <Suspense fallback={<p className="text-foreground/60">Loading…</p>}>
      <Setup params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Setup({ params, searchParams }: Pick<PageProps<"/dashboard/[appId]/setup">, "params" | "searchParams">) {
  const app = await requireApp((await params).appId);
  const { error, done: doneMessage } = await searchParams;
  const newKey = (await cookies()).get(keyCookie(app.id))?.value;
  const base = await origin();
  const webhookUrl = `${base}/api/webhooks/rc/${app.id}`;
  const stripeUrl = `${base}/api/webhooks/stripe/${app.id}`;
  const snippet = sdkSnippet(newKey ?? "fsk_your_key", base);
  const pySnippet = pythonSnippet(newKey ?? "fsk_your_key", base);

  const state = await setupState(app.id);
  const o = state.complete ? await overview(metricsDb(), app.id, lastDays(30)) : null;
  const done = state.complete;
  const stripeConnected = Boolean(app.stripeWebhookSecretCipher);
  const [lastStripe] = stripeConnected
    ? await getDb()
        .select({ at: schema.rcEvents.eventTs })
        .from(schema.rcEvents)
        .where(and(eq(schema.rcEvents.appId, app.id), eq(schema.rcEvents.store, "STRIPE")))
        .orderBy(desc(schema.rcEvents.eventTs))
        .limit(1)
    : [];
  const cap = monthlyEventCap();
  const used = cap === null ? 0 : await eventsThisMonth(metricsDb(), app.id);

  return (
    <div className="flex flex-col gap-6">
      {!done && <AutoRefresh />}

      <PageHeader title={`Set up ${app.name}`} subtitle="Three steps. This page updates by itself as data arrives." />
      <SetupChecklist appId={app.id} state={state} />

      {typeof error === "string" && <Notice tone="error">{error}</Notice>}
      {typeof doneMessage === "string" && <Notice tone="ok">{doneMessage}</Notice>}

      {cap !== null && used >= cap && (
        <Notice tone="error">
          This app reached the monthly limit of {cap.toLocaleString("en-US")} events, so new events are being refused until {nextMonthStart()}. Self-host
          FiscaLLM for no limit, or open an issue if you need more.
        </Notice>
      )}
      {cap !== null && used < cap && used >= cap * 0.8 && (
        <Notice>
          {used.toLocaleString("en-US")} of {cap.toLocaleString("en-US")} events used this month. New events are refused at the limit, which resets on{" "}
          {nextMonthStart()}.
        </Notice>
      )}

      {o && o.matchRate !== null && (
        <Notice>
          {pct(o.matchRate)} of {o.usersWithCost} users with AI cost are matched to revenue. Free users never pay, so 100% is not expected; a
          very low number usually means the user IDs differ.
        </Notice>
      )}

      <Card title="Set up with AI (fastest)">
        <AiSetup />
      </Card>

      <Card title={<span id="usage" className="scroll-mt-24">1. Send AI usage from your backend</span>}>
        {newKey ? (
          <div className="mb-4 flex flex-col gap-2">
            <Notice tone="ok">Your ingest key. It is shown only now; store it as FISCALLM_KEY on your backend.</Notice>
            <CopyField value={newKey} />
            <form action={dismissKey.bind(null, app.id)}>
              <Button variant="secondary" type="submit">
                I have saved it
              </Button>
            </form>
          </div>
        ) : (
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-foreground/70">
            <span>The ingest key was shown once when it was created.</span>
            <form action={rotateKey.bind(null, app.id)}>
              <Button variant="secondary" type="submit">
                Create a new key
              </Button>
            </form>
            <span className="text-xs">(the old one stops working)</span>
          </div>
        )}
        <p className="mb-2 text-sm">
          <strong>TypeScript:</strong> <Code>npm install fiscallm</Code>, then after each AI call:
        </p>
        <div className="relative">
          <pre className="overflow-x-auto rounded bg-foreground/5 p-3 font-mono text-xs leading-relaxed">{snippet}</pre>
          <div className="absolute right-2 top-2">
            <CopyButton value={snippet} />
          </div>
        </div>
        <p className="mb-2 mt-4 text-sm">
          <strong>Python:</strong> <Code>pip install fiscallm</Code>, then:
        </p>
        <div className="relative">
          <pre className="overflow-x-auto rounded bg-foreground/5 p-3 font-mono text-xs leading-relaxed">{pySnippet}</pre>
          <div className="absolute right-2 top-2">
            <CopyButton value={pySnippet} />
          </div>
        </div>
        <p className="mt-3 text-sm text-foreground/70">
          <strong>userId must be the RevenueCat app user ID.</strong> If your app uses RevenueCat&apos;s anonymous IDs,
          send <Code>Purchases.shared.appUserID</Code> from the app to your backend with each request.
        </p>
      </Card>

      <Card title={<span id="revenue" className="scroll-mt-24">2. Connect revenue: RevenueCat, or send it yourself</span>}>
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
          <li>In RevenueCat, open your project → Integrations → Webhooks → Add new configuration.</li>
          <li>
            Webhook URL:
            <div className="mt-1">
              <CopyField value={webhookUrl} />
            </div>
          </li>
          <li>
            Authorization header value:
            <div className="mt-1">
              <CopyField value={app.rcWebhookSecret} secret />
            </div>
          </li>
          <li>Environment: Production (or both, and turn on test mode in Settings while testing). Save, then press &quot;Send test event&quot;.</li>
        </ol>
        <p className="mt-3 text-sm text-foreground/70">
          Not using RevenueCat, or some payments go through Stripe? Report them with <Code>meter.trackRevenue(…)</Code>; see{" "}
          <Link href="/docs#revenue-api" className="underline">
            the docs
          </Link>
          .
        </p>
        <p className="mt-2 text-sm text-foreground/70">
          RevenueCat sends only new events. To include subscribers who paid before today,{" "}
          <Link href={`/dashboard/${app.id}/settings#import`} className="underline">
            import them from RevenueCat
          </Link>
          .
        </p>
      </Card>

      <Card title={<span id="stripe" className="scroll-mt-24">Optional: connect Stripe</span>}>
        <p className="text-sm text-foreground/70">
          If you bill through Stripe, FiscaLLM can read your payments, refunds and trials from a Stripe webhook. This is a beta: it is tested against sample
          payloads, so check the first week of numbers against your Stripe dashboard. USD only for now.
        </p>
        <ol className="mt-3 flex list-decimal flex-col gap-3 pl-5 text-sm">
          <li>
            In Stripe, open Developers → Webhooks → Add endpoint, and use this URL:
            <div className="mt-1">
              <CopyField value={stripeUrl} />
            </div>
          </li>
          <li>
            Choose these events: <Code>invoice.paid</Code>, <Code>customer.subscription.created</Code>, <Code>customer.subscription.updated</Code>,{" "}
            <Code>customer.subscription.deleted</Code> and <Code>charge.refunded</Code>.
          </li>
          <li>Copy the endpoint&apos;s signing secret (it starts with whsec_) and paste it here:</li>
        </ol>
        <form action={connectStripe.bind(null, app.id)} className="mt-2 flex flex-wrap items-center gap-2">
          <Input name="signingSecret" type="password" autoComplete="off" placeholder="whsec_…" className="min-w-[16rem] flex-1" />
          <Button type="submit">{stripeConnected ? "Replace secret" : "Connect Stripe"}</Button>
        </form>
        {stripeConnected && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-green-700">
              Connected{lastStripe ? `. Last event ${lastStripe.at.toISOString().slice(0, 16).replace("T", " ")} UTC` : ". No events yet; send a test event from Stripe."}
            </span>
            <form action={disconnectStripe.bind(null, app.id)}>
              <Button variant="secondary" type="submit">
                Disconnect
              </Button>
            </form>
          </div>
        )}
        <p className="mt-4 text-sm text-foreground/70">
          <strong>Matching payments to your users.</strong> Set <Code>metadata.user_id</Code> on the Stripe subscription (or customer) to the same user ID you
          send from your backend. Without it, FiscaLLM uses the Stripe customer ID (<Code>cus_…</Code>), so then report that as the <Code>userId</Code> in your
          SDK calls. What you keep is estimated as the payment minus tax minus Stripe&apos;s standard fee (2.9% + $0.30).
        </p>
      </Card>
    </div>
  );
}



function pythonSnippet(key: string, base: string) {
  const endpoint = base === "https://fiscallm.com" ? "" : `, endpoint="${base}/api/v1/events"`;
  return `import os
from fiscallm import Meter

# FISCALLM_KEY=${key}
meter = Meter(api_key=os.environ["FISCALLM_KEY"]${endpoint})  # one per process

res = client.chat.completions.create(model=model, messages=messages)
meter.track_openai(res, user_id=user_id, feature="chat")
# also: track_anthropic, track_gemini, track_stream, track
# AWS Lambda / Cloud Functions: meter.flush() before returning`;
}

function sdkSnippet(key: string, base: string) {
  // The SDK sends to fiscallm.com by default; other hosts (previews, local) need the endpoint.
  const endpoint = base === "https://fiscallm.com" ? "" : `\n  endpoint: "${base}/api/v1/events",`;
  return `import { createMeter } from "fiscallm";

// FISCALLM_KEY=${key}
const meter = createMeter({
  apiKey: env.FISCALLM_KEY,${endpoint}
  // Cloudflare Workers: ctx.waitUntil.bind(ctx); Vercel: waitUntil from @vercel/functions
  waitUntil,
});

const res = await openai.chat.completions.create({ model, messages });
meter.trackOpenAI(res, { userId, feature: "chat" });
// also: meter.trackAnthropic, meter.trackGemini, meter.trackStream, meter.track`;
}
