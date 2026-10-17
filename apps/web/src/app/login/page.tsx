import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Button, Input, Notice } from "@/components/ui";
import { sendLoginLink } from "./actions";

export const metadata: Metadata = { title: "Sign in · FiscaLLM", alternates: { canonical: "/login" }, robots: { index: false, follow: true } };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell title="Sign in or create your account" subtitle="We email you a link. No password needed.">
      <Suspense>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function LoginForm({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { sent, error } = await searchParams;

  if (sent) {
    return (
      <Notice tone="ok">
        Check your email for a sign-in link. It works once and expires after an hour. You can close this tab.
      </Notice>
    );
  }

  return (
    <form action={sendLoginLink} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Work email</span>
        <Input type="email" name="email" required autoComplete="email" placeholder="you@company.com" className="py-2" />
      </label>
      <Button type="submit" className="btn-glow mt-1 rounded-full py-2.5">
        Continue with email
      </Button>
      {typeof error === "string" && <Notice tone="error">{error}</Notice>}
      <p className="mt-2 text-xs text-muted">
        By continuing you agree to the <a href="/terms" className="underline">terms</a> and <a href="/privacy" className="underline">privacy policy</a>.
      </p>
    </form>
  );
}
