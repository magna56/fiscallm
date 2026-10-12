import { Suspense } from "react";
import { sendLoginLink } from "./actions";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Sign in to FiscaLLM</h1>
      <Suspense>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginForm({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { sent, error } = await searchParams;

  if (sent) return <p>Check your email for a sign-in link.</p>;

  return (
    <form action={sendLoginLink} className="flex flex-col gap-3">
      <input
        type="email"
        name="email"
        required
        placeholder="you@example.com"
        className="rounded border border-foreground/20 bg-transparent px-3 py-2"
      />
      <button
        type="submit"
        className="rounded bg-foreground px-3 py-2 font-medium text-background"
      >
        Email me a sign-in link
      </button>
      {typeof error === "string" && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </form>
  );
}
