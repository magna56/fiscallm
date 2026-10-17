import { schema } from "@fiscallm/shared";
import { breakdown, lastDays } from "@fiscallm/shared/metrics";
import { asc, eq } from "drizzle-orm";
import { Suspense } from "react";
import { Button, Card, Code, Input, Notice } from "@/components/ui";
import { requireApp } from "@/lib/auth";
import { getDb, metricsDb } from "@/lib/db";
import {
  addOverride,
  deleteApp,
  deleteAppData,
  deleteOverride,
  rotateKey,
  rotateWebhookSecret,
  sendTestReport,
  setTestMode,
  setWeeklyEmail,
} from "../../actions";
import Link from "next/link";

export default function SettingsPage(props: PageProps<"/dashboard/[appId]/settings">) {
  return (
    <Suspense fallback={<p className="text-foreground/60">Loading…</p>}>
      <Settings {...props} />
    </Suspense>
  );
}

async function Settings({ params, searchParams }: PageProps<"/dashboard/[appId]/settings">) {
  const app = await requireApp((await params).appId);
  const { error, done } = await searchParams;
  const overrides = await getDb()
    .select()
    .from(schema.appPriceOverrides)
    .where(eq(schema.appPriceOverrides.appId, app.id))
    .orderBy(asc(schema.appPriceOverrides.provider), asc(schema.appPriceOverrides.model));
  const unpriced = (await breakdown(metricsDb(), app.id, lastDays(90))).byModel.filter((m) => m.unpriced > 0);

  return (
    <div className="flex flex-col gap-6">
      {typeof error === "string" && <Notice tone="error">{error}</Notice>}
      {typeof done === "string" && <Notice tone="ok">{done}</Notice>}

      <Card title="Keys">
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Ingest key (used by the SDK)</span>
            <form action={rotateKey.bind(null, app.id)}>
              <Button variant="secondary" type="submit">
                Replace key
              </Button>
            </form>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>RevenueCat authorization value</span>
            <form action={rotateWebhookSecret.bind(null, app.id)}>
              <Button variant="secondary" type="submit">
                Replace value
              </Button>
            </form>
          </div>
          <p className="text-foreground/60">Replacing either one stops the old value working immediately; update your backend or RevenueCat right after.</p>
        </div>
      </Card>

      <Card title="Test mode">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-foreground/70">
            {app.testMode
              ? "On: RevenueCat sandbox purchases count as revenue."
              : "Off: RevenueCat sandbox purchases are stored but not counted."}
          </p>
          <form action={setTestMode.bind(null, app.id, !app.testMode)}>
            <Button variant="secondary" type="submit">
              Turn {app.testMode ? "off" : "on"}
            </Button>
          </form>
        </div>
      </Card>

      <Card title="Weekly email">
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-foreground/70">
              {app.weeklyEmail
                ? "On: every Monday you get last week's cost, revenue and the users and plans that lost money."
                : "Off."}
            </p>
            <form action={setWeeklyEmail.bind(null, app.id, !app.weeklyEmail)}>
              <Button variant="secondary" type="submit">
                Turn {app.weeklyEmail ? "off" : "on"}
              </Button>
            </form>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <form action={sendTestReport.bind(null, app.id)}>
              <Button variant="secondary" type="submit">
                Send me this week&apos;s report now
              </Button>
            </form>
            <Link href={`/dashboard/${app.id}/report`} className="underline">
              Preview
            </Link>
          </div>
        </div>
      </Card>

      <Card title="Your AI prices">
        <p className="mb-3 text-sm text-foreground/70">
          Costs use public list prices. If you have a negotiated rate, add a discount for a provider or your own prices for a model.
          Changes apply to events received from now on.
        </p>
        {overrides.length > 0 && (
          <table className="mb-4 w-full text-sm">
            <thead className="text-left text-foreground/60">
              <tr>
                <th className="py-1 font-normal">Provider</th>
                <th className="font-normal">Model</th>
                <th className="font-normal">From</th>
                <th className="font-normal">Price</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {overrides.map((o) => (
                <tr key={`${o.provider}/${o.model}/${o.effectiveFrom}`} className="border-t border-foreground/10">
                  <td className="py-1.5">{o.provider}</td>
                  <td>{o.model === "*" ? "all models" : o.model}</td>
                  <td>{o.effectiveFrom}</td>
                  <td>
                    {o.discountPct !== null
                      ? `${Number(o.discountPct)}% off list`
                      : `$${Number(o.inputPerMtok)} in / $${Number(o.outputPerMtok)} out per 1M`}
                  </td>
                  <td className="text-right">
                    <form action={deleteOverride.bind(null, app.id, o.provider, o.model, o.effectiveFrom)}>
                      <button type="submit" className="text-xs underline">
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={addOverride.bind(null, app.id)} className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Input name="provider" required placeholder="Provider, e.g. openai" />
          <Input name="model" placeholder="Model (blank = all)" />
          <Input name="effectiveFrom" placeholder="From YYYY-MM-DD" />
          <Input name="discountPct" inputMode="decimal" placeholder="Discount %" />
          <Input name="inputPerMtok" inputMode="decimal" placeholder="or input $/1M" />
          <Input name="outputPerMtok" inputMode="decimal" placeholder="output $/1M" />
          <Input name="cachedPerMtok" inputMode="decimal" placeholder="cached $/1M (optional)" />
          <Button type="submit">Add</Button>
        </form>
      </Card>

      <Card title="Unpriced models">
        {unpriced.length === 0 ? (
          <p className="text-sm text-foreground/70">Every model seen in the last 90 days has a price.</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-foreground/70">
              These models have no list price, so their cost shows as zero. Add your own price above, or send <Code>costUsd</Code> from the SDK.
            </p>
            <ul className="text-sm">
              {unpriced.map((m) => (
                <li key={m.key}>
                  <Code>{m.key}</Code> – {m.unpriced} requests
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card title="Danger zone" className="border-red-600/30">
        <div className="flex flex-col gap-4 text-sm">
          <form action={deleteAppData.bind(null, app.id)} className="flex flex-wrap items-center gap-2">
            <span className="w-full text-foreground/70">Delete all AI events, RevenueCat events and subscriber data. Keys stay.</span>
            <Input name="confirm" required placeholder={`Type "${app.name}"`} />
            <Button variant="danger" type="submit">
              Delete data
            </Button>
          </form>
          <form action={deleteApp.bind(null, app.id)} className="flex flex-wrap items-center gap-2">
            <span className="w-full text-foreground/70">Delete the app and everything in it.</span>
            <Input name="confirm" required placeholder={`Type "${app.name}"`} />
            <Button variant="danger" type="submit">
              Delete app
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
