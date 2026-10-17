import { schema } from "@fiscallm/shared";
import { lastDays, overview } from "@fiscallm/shared/metrics";
import { count, eq, max } from "drizzle-orm";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { AiSetup } from "@/components/ai-setup";
import { AutoRefresh } from "@/components/auto-refresh";
import { CopyButton, CopyField } from "@/components/copy-button";
import { Button, Card, Code, Notice, pct } from "@/components/ui";
import { requireApp } from "@/lib/auth";
import { getDb, metricsDb } from "@/lib/db";
import { keyCookie } from "@/lib/key-cookie";
import { origin } from "@/lib/origin";
import { dismissKey, rotateKey } from "../../actions";

export default function SetupPage({ params }: PageProps<"/dashboard/[appId]/setup">) {
  return (
    <Suspense fallback={<p className="text-foreground/60">Loading…</p>}>
      <Setup params={params} />
    </Suspense>
  );
}

async function Setup({ params }: Pick<PageProps<"/dashboard/[appId]/setup">, "params">) {
  const app = await requireApp((await params).appId);
  const newKey = (await cookies()).get(keyCookie(app.id))?.value;
  const base = await origin();
  const webhookUrl = `${base}/api/webhooks/rc/${app.id}`;
  const snippet = sdkSnippet(newKey ?? "fsk_your_key", base);
  const pySnippet = pythonSnippet(newKey ?? "fsk_your_key", base);

  const db = getDb();
  const [ai] = await db
    .select({ n: count(), last: max(schema.aiEvents.ts) })
    .from(schema.aiEvents)
    .where(eq(schema.aiEvents.appId, app.id));
  const [rc] = await db
    .select({ n: count(), last: max(schema.rcEvents.eventTs) })
    .from(schema.rcEvents)
    .where(eq(schema.rcEvents.appId, app.id));
  const o = ai!.n > 0 ? await overview(metricsDb(), app.id, lastDays(30)) : null;
  const done = ai!.n > 0 && rc!.n > 0;

  return (
    <div className="flex flex-col gap-6">
      {!done && <AutoRefresh />}

      <Card title="Status">
        <ul className="flex flex-col gap-2 text-sm">
          <Check ok={ai!.n > 0} label="First AI event received" detail={ai!.last ? `${ai!.n} events, last ${ago(ai!.last)}` : "Waiting for your backend…"} />
          <Check ok={rc!.n > 0} label="First RevenueCat webhook received" detail={rc!.n > 0 ? `${rc!.n} events, latest dated ${ago(rc!.last!)}` : "Waiting for RevenueCat…"} />
          <Check
            ok={(o?.matchRate ?? 0) > 0}
            label="AI users matched to RevenueCat"
            detail={
              o?.matchRate == null
                ? "Shown once both are connected"
                : `${pct(o.matchRate)} of ${o.usersWithCost} users with AI cost in the last 30 days. Free users never appear in RevenueCat, so 100% is not expected.`
            }
          />
        </ul>
      </Card>

      <Card title="Set up with AI (fastest)">
        <AiSetup />
      </Card>

      <Card title="1. Send AI usage from your backend">
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

      <Card title="2. Connect RevenueCat">
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
          RevenueCat sends only new events. To include subscribers who paid before today,{" "}
          <Link href={`/dashboard/${app.id}/settings#import`} className="underline">
            import them from RevenueCat
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}

function Check({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex gap-2">
      <span className={ok ? "text-green-600" : "text-foreground/30"}>{ok ? "✓" : "○"}</span>
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-foreground/60">{detail}</span>
      </span>
    </li>
  );
}

function ago(d: Date | string) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
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
