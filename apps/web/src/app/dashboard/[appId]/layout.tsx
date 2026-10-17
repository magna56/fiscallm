import Link from "next/link";
import { Suspense } from "react";
import { requireApp } from "@/lib/auth";
import { Nav } from "./nav";

export default function AppLayout({ children, params }: LayoutProps<"/dashboard/[appId]">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="font-semibold">
            FiscaLLM
          </Link>
          <span className="text-foreground/40">/</span>
          <Suspense fallback={<span className="text-foreground/40">…</span>}>
            <AppName params={params} />
          </Suspense>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/account" className="underline">
            Account
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <Suspense>
        <Nav params={params} />
      </Suspense>
      {children}
    </main>
  );
}

async function AppName({ params }: { params: Promise<{ appId: string }> }) {
  const app = await requireApp((await params).appId);
  return <span>{app.name}</span>;
}
