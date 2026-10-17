import { schema } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { completeWelcome } from "./actions";
import { ProfileForm } from "./profile-form";

export default function WelcomePage(props: PageProps<"/welcome">) {
  return (
    <AuthShell title="Welcome to FiscaLLM" subtitle="A few details about you, then you'll add your first app." aside={false}>
      <Suspense>
        <Welcome {...props} />
      </Suspense>
    </AuthShell>
  );
}

async function Welcome({ searchParams }: PageProps<"/welcome">) {
  const user = await requireUser();
  const [existing] = await getDb().select().from(schema.profiles).where(eq(schema.profiles.userId, user.id));
  if (existing) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <div className="flex flex-col gap-4">
      {typeof error === "string" && <Notice tone="error">{error}</Notice>}
      <ProfileForm action={completeWelcome} submit="Continue" />
      <p className="text-xs text-muted">Signed in as {user.email}</p>
    </div>
  );
}
