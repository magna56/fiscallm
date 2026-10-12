import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default function DashboardPage() {
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
        <Account />
      </Suspense>
    </main>
  );
}

async function Account() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <p>Signed in as {user.email}.</p>
      <p className="text-foreground/60">No apps yet.</p>
    </>
  );
}
