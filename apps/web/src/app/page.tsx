import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-4xl font-semibold">FiscaLLM</h1>
      <p className="text-lg text-foreground/70">
        See what each user costs you in AI, against what they pay.
      </p>
      <Link
        href="/login"
        className="w-fit rounded bg-foreground px-4 py-2 font-medium text-background"
      >
        Sign in
      </Link>
    </main>
  );
}
