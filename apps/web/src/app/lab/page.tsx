import { schema } from "@fiscallm/shared";
import { asc, eq } from "drizzle-orm";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Lab } from "./lab";

export default function LabPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">FiscaLLM lab</h1>
      <p className="text-sm text-foreground/70">An end-to-end test: a Test Store purchase, then real AI calls reported with the fiscallm SDK.</p>
      <Suspense fallback={<p className="text-foreground/60">Loading…</p>}>
        <SignedIn />
      </Suspense>
    </main>
  );
}

async function SignedIn() {
  const user = await requireUser();
  const [app] = await getDb()
    .select({ id: schema.apps.id })
    .from(schema.apps)
    .where(eq(schema.apps.ownerId, user.id))
    .orderBy(asc(schema.apps.createdAt))
    .limit(1);
  return <Lab dashboardUrl={app ? `/dashboard/${app.id}` : "/dashboard"} />;
}
