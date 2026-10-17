import { schema } from "@fiscallm/shared";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { Button, Card, Input, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createApp } from "./actions";

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">FiscaLLM</h1>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm underline">
            Sign out
          </button>
        </form>
      </header>
      <Suspense fallback={<p className="text-foreground/60">Loading…</p>}>
        <Apps searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Apps({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  const user = await requireUser();
  const { error } = await searchParams;
  const apps = await getDb()
    .select({ id: schema.apps.id, name: schema.apps.name })
    .from(schema.apps)
    .where(eq(schema.apps.ownerId, user.id))
    .orderBy(desc(schema.apps.createdAt));

  return (
    <>
      <p className="text-sm text-foreground/60">Signed in as {user.email}</p>
      {apps.length > 0 && (
        <Card title="Your apps">
          <ul className="divide-y divide-foreground/10">
            {apps.map((a) => (
              <li key={a.id}>
                <Link href={`/dashboard/${a.id}`} className="block py-2 hover:underline">
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title={apps.length ? "Add another app" : "Add your first app"}>
        <p className="mb-3 text-sm text-foreground/70">
          One app per mobile app. You get an ingest key for your backend and a webhook URL for RevenueCat.
        </p>
        <form action={createApp} className="flex gap-2">
          <Input name="name" required maxLength={100} placeholder="App name" className="flex-1" />
          <Button type="submit">Create</Button>
        </form>
        {typeof error === "string" && (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
      </Card>
    </>
  );
}
