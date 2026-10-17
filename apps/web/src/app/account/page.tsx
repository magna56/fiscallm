import type { Metadata } from "next";
import { schema } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { CONTACT, Logo } from "@/components/site";
import { Card, Notice } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { updateProfile } from "../welcome/actions";
import { ProfileForm } from "../welcome/profile-form";

export const metadata: Metadata = { title: "Account · FiscaLLM", robots: { index: false, follow: false } };

export default function AccountPage(props: PageProps<"/account">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <Link href="/dashboard" className="text-sm underline">
          Back to dashboard
        </Link>
      </header>
      <h1 className="text-2xl font-semibold">Account</h1>
      <Suspense fallback={<p className="text-foreground/60">Loading…</p>}>
        <Account {...props} />
      </Suspense>
    </main>
  );
}

async function Account({ searchParams }: PageProps<"/account">) {
  const user = await requireUser();
  const [profile] = await getDb().select().from(schema.profiles).where(eq(schema.profiles.userId, user.id));
  const { error, done } = await searchParams;
  return (
    <>
      {typeof error === "string" && <Notice tone="error">{error}</Notice>}
      {typeof done === "string" && <Notice tone="ok">{done}</Notice>}
      <Card title="Your details">
        <ProfileForm action={updateProfile} values={profile} submit="Save" />
      </Card>
      <Card title="Sign-in">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>
            Signed in as <strong>{user.email}</strong>
          </span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="underline">
              Sign out
            </button>
          </form>
        </div>
        <p className="mt-3 text-xs text-foreground/60">
          To change your email or delete your account, email <a href={`mailto:${CONTACT}`} className="underline">{CONTACT}</a>.
        </p>
      </Card>
    </>
  );
}
