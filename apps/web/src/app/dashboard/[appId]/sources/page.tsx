import { schema } from "@fiscallm/shared";
import { SOURCE_GROUPS, SOURCES, type SourceGroup, type SourceInfo } from "@fiscallm/shared/sources";
import { and, count, eq, gt, inArray, isNull, max, sql, sum } from "drizzle-orm";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { Button, Card, Input, Notice, PageHeader, usd } from "@/components/ui";
import { requireApp } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { keyCookie } from "@/lib/key-cookie";
import { origin } from "@/lib/origin";
import { connectSource, disconnectSource, syncSourceNow } from "../../actions";

export default function SourcesPage(props: PageProps<"/dashboard/[appId]/sources">) {
  return (
    <Suspense fallback={<p className="text-foreground/60">Loading…</p>}>
      <Sources {...props} />
    </Suspense>
  );
}

interface Activity {
  calls: number;
  cost: number;
  last: Date | null;
}
type Connection = typeof schema.appSources.$inferSelect;

const DAY_MS = 86_400_000;
const thirtyDaysAgo = () => new Date(Date.now() - 30 * DAY_MS);
const when = (d: Date | null) => (d ? d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "never");

async function Sources({ params, searchParams }: PageProps<"/dashboard/[appId]/sources">) {
  const app = await requireApp((await params).appId);
  const { error, done } = await searchParams;
  const key = (await cookies()).get(keyCookie(app.id))?.value ?? "fsk_your_key";
  const base = await origin();
  const db = getDb();
  const since = thirtyDaysAgo();

  // One query at a time: the database pooler cannot pipeline.
  const e = schema.aiEvents;
  const totals = { calls: count(), cost: sum(e.costUsd), last: max(e.ts) };
  const bySource = await db
    .select({ id: sql<string>`coalesce(${e.source}, '')`, ...totals })
    .from(e)
    .where(and(eq(e.appId, app.id), gt(e.ts, since)))
    .groupBy(sql`1`);
  const providers = SOURCES.flatMap((s) => (s.provider ? [s.provider] : []));
  const byProvider = await db
    .select({ id: e.provider, ...totals })
    .from(e)
    .where(and(eq(e.appId, app.id), gt(e.ts, since), isNull(e.source), inArray(e.provider, providers)))
    .groupBy(e.provider);
  const connections = await db.select().from(schema.appSources).where(eq(schema.appSources.appId, app.id));

  const toActivity = (r: { calls: number; cost: string | null; last: Date | null }): Activity => ({ calls: r.calls, cost: Number(r.cost ?? 0), last: r.last });
  const activity = (s: SourceInfo): Activity | undefined => {
    const row = s.provider ? byProvider.find((r) => r.id === s.provider) : bySource.find((r) => r.id === (s.id === "sdk" ? "" : s.id));
    return row ? toActivity(row) : undefined;
  };

  const groups = Object.keys(SOURCE_GROUPS) as SourceGroup[];
  const on = SOURCES.filter((s) => activity(s) || connections.some((c) => c.source === s.id)).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sources"
        subtitle={`Every AI tool your team or product uses, in one place. Turn on the ones you use: ${on} of ${SOURCES.filter((s) => s.kind !== "planned").length} on.`}
      />
      {typeof error === "string" && <Notice tone="error">{error}</Notice>}
      {typeof done === "string" && <Notice tone="ok">{done}</Notice>}
      {key === "fsk_your_key" && (
        <Notice>
          The settings below show <code>fsk_your_key</code> where your ingest key goes. The key is shown once, when it is created; if you no longer have it,{" "}
          <Link className="underline" href={`/dashboard/${app.id}/setup`}>
            make a new one in Setup
          </Link>{" "}
          and come back here to copy the settings with it filled in.
        </Notice>
      )}

      {groups.map((g) => (
        <section key={g} className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{SOURCE_GROUPS[g].title}</h2>
            <p className="text-sm text-muted">{SOURCE_GROUPS[g].blurb}</p>
          </div>
          {SOURCES.filter((s) => s.group === g).map((s) => (
            <SourceCard key={s.id} appId={app.id} source={s} activity={activity(s)} connection={connections.find((c) => c.source === s.id)} ingestKey={key} base={base} />
          ))}
        </section>
      ))}

      <p className="text-sm text-muted">
        Missing a tool?{" "}
        <a className="underline" href="https://github.com/magna56/fiscallm/issues/new?labels=source&title=Source%3A%20">
          Ask for it on GitHub
        </a>
        . Each source is one file in the open-source code, so you can also{" "}
        <a className="underline" href="https://github.com/magna56/fiscallm/blob/main/CONTRIBUTING.md#adding-a-source">
          add one yourself
        </a>
        .
      </p>
    </div>
  );
}

function Status({ activity, connection, planned }: { activity?: Activity; connection?: Connection; planned: boolean }) {
  if (planned) return <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-xs text-black/60">Planned</span>;
  if (connection?.lastError) return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">Needs attention</span>;
  if (activity) return <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">On</span>;
  if (connection) return <span className="rounded-full bg-[#6d5dfc]/10 px-2 py-0.5 text-xs text-[#4c3fd1]">Connected</span>;
  return <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-xs text-black/60">Off</span>;
}

function SourceCard({ appId, source: s, activity, connection, ingestKey, base }: { appId: string; source: SourceInfo; activity?: Activity; connection?: Connection; ingestKey: string; base: string }) {
  const planned = s.kind === "planned";
  return (
    <div id={s.id} className="scroll-mt-20">
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {s.name}
            <Status activity={activity} connection={connection} planned={planned} />
            {!s.verifiedLive && !planned && (
              <span className="rounded-full border border-black/10 px-2 py-0.5 text-xs font-normal text-black/50" title="Built and tested against the tool's published format; not yet run against a live account">
                beta
              </span>
            )}
          </span>
        }
        action={
          s.docs ? (
            <Link className="text-sm text-muted underline" href={s.docs}>
              Docs
            </Link>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-foreground/75">{s.summary}</p>
          {activity && (
            <p className="text-foreground/75">
              Last 30 days: <strong>{activity.calls.toLocaleString("en-US")}</strong> {activity.calls === 1 ? "record" : "records"},{" "}
              <strong>{usd(activity.cost)}</strong>. Latest {when(activity.last)}.
            </p>
          )}

          {planned && s.issue && (
            <p>
              Not built yet.{" "}
              <a className="underline" href={s.issue}>
                Vote for it on GitHub
              </a>{" "}
              and it moves up the list.
            </p>
          )}

          {s.key && !connection && (
            <form action={connectSource.bind(null, appId, s.id)} className="flex flex-col gap-2">
              <label className="text-foreground/75" htmlFor={`${s.id}-key`}>
                {s.key.help}{" "}
                <a className="underline" href={s.key.url} target="_blank" rel="noreferrer">
                  Open
                </a>
              </label>
              <div className="flex flex-wrap gap-2">
                <Input id={`${s.id}-key`} name="key" type="password" autoComplete="off" required placeholder={s.key.placeholder} className="min-w-64 flex-1" />
                <Button>Connect</Button>
              </div>
              <p className="text-xs text-muted">The key is checked with {s.name}, then stored encrypted. It is only used to read usage.</p>
            </form>
          )}

          {connection && (
            <div className="flex flex-col gap-2 rounded-xl border border-black/[0.06] p-3">
              <p className="text-foreground/75">
                Read up to {when(connection.syncedUntil)}. Last sync {when(connection.lastSyncAt)}. Synced once a day.
              </p>
              {connection.lastError && <Notice tone="error">{connection.lastError}</Notice>}
              <div className="flex flex-wrap gap-2">
                <form action={syncSourceNow.bind(null, appId, s.id)}>
                  <Button variant="secondary">Sync now</Button>
                </form>
                <form action={disconnectSource.bind(null, appId, s.id)}>
                  <Button variant="danger">Disconnect</Button>
                </form>
              </div>
            </div>
          )}

          {s.setup?.(ingestKey, base).map((snip) => (
            <div key={snip.where} className="flex flex-col gap-1">
              <p className="text-xs text-muted">{snip.where}</p>
              <div className="relative">
                <pre className="overflow-x-auto rounded bg-foreground/5 p-3 pr-16 font-mono text-xs leading-relaxed">{snip.code}</pre>
                <div className="absolute right-2 top-2">
                  <CopyButton value={snip.code} />
                </div>
              </div>
            </div>
          ))}

          {(s.user || s.cost || s.notes?.length) && (
            <details className="text-foreground/70">
              <summary className="cursor-pointer text-muted">What is read, and limits</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {s.user && <li>Who: {s.user}</li>}
                {s.cost && <li>Cost: {s.cost}</li>}
                {s.notes?.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </Card>
    </div>
  );
}
