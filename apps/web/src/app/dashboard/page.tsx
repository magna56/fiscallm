import { schema } from "@fiscallm/shared";
import { lastDays, overview } from "@fiscallm/shared/metrics";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Card, Input, Notice, PageHeader, usd } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb, metricsDb } from "@/lib/db";
import { createApp } from "./actions";

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<div className="flex-1 bg-[#f7f7fb]" />}>
      <Apps searchParams={searchParams} />
    </Suspense>
  );
}

async function Apps({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  const user = await requireUser();
  const db = getDb();
  const [profile] = await db.select({ name: schema.profiles.fullName }).from(schema.profiles).where(eq(schema.profiles.userId, user.id));
  if (!profile) redirect("/welcome");
  const { error } = await searchParams;
  const apps = await db
    .select({ id: schema.apps.id, name: schema.apps.name })
    .from(schema.apps)
    .where(eq(schema.apps.ownerId, user.id))
    .orderBy(desc(schema.apps.createdAt));

  // One app at a time: the database pooler does not take parallel queries.
  const stats = [];
  for (const a of apps) stats.push({ ...a, o: await overview(metricsDb(), a.id, lastDays(30)) });

  const firstName = profile.name.split(" ")[0];
  const create = (
    <form action={createApp} className="flex flex-col gap-2 sm:flex-row">
      <Input name="name" required maxLength={100} placeholder="App name, e.g. PhotoAI" className="flex-1" />
      <Button type="submit">Create app</Button>
    </form>
  );

  return (
    <AppShell>
      <PageHeader title={`Hi ${firstName}`} subtitle={apps.length ? "Your apps, last 30 days." : "Let's get your first app set up."} />
      {typeof error === "string" && <Notice tone="error">{error}</Notice>}

      {apps.length === 0 ? (
        <Card>
          <ol className="grid gap-4 md:grid-cols-3">
            {[
              ["Create an app", "One per mobile app. You get a key and a webhook URL."],
              ["Connect it", "One line in your backend, and RevenueCat or the revenue API."],
              ["See your margins", "Cost against revenue for every user, plan and trial."],
            ].map(([t, b], i) => (
              <li key={t} className="rounded-xl bg-[#f7f7fb] p-4">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#6d5dfc] text-sm font-semibold text-white">{i + 1}</span>
                <div className="mt-3 font-medium">{t}</div>
                <div className="mt-1 text-sm text-muted">{b}</div>
              </li>
            ))}
          </ol>
          <div className="mt-6">{create}</div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map(({ id, name, o }) => {
            const empty = o.requests === 0 && o.revenueUsd === 0;
            return (
              <Link
                key={id}
                href={`/dashboard/${id}`}
                className="group rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(16,16,32,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(109,93,252,0.35)]"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#6d5dfc]/15 to-[#ec4899]/15 text-sm text-[#4c3fd1]">
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                    {name}
                  </span>
                  <span className="text-black/30 transition group-hover:translate-x-0.5 group-hover:text-[#6d5dfc]">→</span>
                </div>
                {empty ? (
                  <p className="mt-5 text-sm text-muted">No data yet. Finish setup →</p>
                ) : (
                  <dl className="mt-5 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted">AI cost</dt>
                      <dd className="font-semibold tabular-nums">{usd(o.costUsd)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Revenue</dt>
                      <dd className="font-semibold tabular-nums">{usd(o.revenueUsd)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Margin</dt>
                      <dd className={`font-semibold tabular-nums ${o.marginUsd < 0 ? "text-red-600" : "text-green-600"}`}>{usd(o.marginUsd)}</dd>
                    </div>
                  </dl>
                )}
              </Link>
            );
          })}
          <div className="rounded-2xl border border-dashed border-black/15 bg-white/60 p-5">
            <div className="font-semibold">New app</div>
            <p className="mb-3 mt-1 text-sm text-muted">One per mobile app.</p>
            {create}
          </div>
        </div>
      )}
    </AppShell>
  );
}
