import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site";

const STEPS = [
  {
    title: "Report usage from your backend",
    body: "One call after each AI request: meter.trackOpenAI(res, { userId }). Works with OpenAI, Anthropic, Gemini and anything with a price. It runs in the background and never blocks or breaks your response.",
  },
  {
    title: "Connect RevenueCat",
    body: "Paste one webhook URL. Purchases, renewals, trials and refunds arrive as they happen, net of store fees and tax.",
  },
  {
    title: "See who costs more than they pay",
    body: "AI cost against revenue per user, per plan and per trial cohort. The users losing you money, sorted worst first.",
  },
];

const QUESTIONS = [
  ["What does it store?", "User IDs, token counts, model names and subscription events. Never prompts or responses: they stay on your backend."],
  ["Which apps is it for?", "Subscription apps that call AI models from their own backend (a Worker, Supabase or Firebase function, or a Node server) and use RevenueCat."],
  ["How is cost calculated?", "From the providers' list prices, kept up to date, including cached tokens and long-prompt pricing. Negotiated rates can be added per provider or model."],
  ["What does it cost?", "Nothing during the beta."],
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-20 px-6 pb-20 pt-10">
        <section className="flex flex-col items-start gap-6">
          <p className="rounded-full border border-foreground/15 px-3 py-1 text-xs text-foreground/70">
            For AI-powered subscription apps on RevenueCat
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Know which users cost you more in AI than they pay.
          </h1>
          <p className="max-w-2xl text-lg text-foreground/70">
            FiscaLLM puts each user&apos;s AI spend next to their subscription revenue, so you can see your real margin per user,
            per plan and per free trial before the bill arrives.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="rounded bg-foreground px-4 py-2 font-medium text-background">
              Start free
            </Link>
            <Link href="/docs" className="rounded border border-foreground/20 px-4 py-2 font-medium">
              Read the docs
            </Link>
          </div>
          <p className="text-sm text-foreground/50">Free during the beta. Ten minutes to set up.</p>
        </section>

        <section className="overflow-hidden rounded-xl border border-foreground/10 shadow-sm">
          <Image
            src="/screenshots/overview.png"
            alt="FiscaLLM dashboard: AI cost, net revenue and margin, with a daily chart and cost by model"
            width={924}
            height={492}
            priority
            className="h-auto w-full"
          />
        </section>

        <section>
          <h2 className="mb-6 text-2xl font-semibold">How it works</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-lg border border-foreground/10 p-5">
                <div className="mb-2 text-sm text-foreground/50">{i + 1}</div>
                <h3 className="mb-2 font-medium">{s.title}</h3>
                <p className="text-sm text-foreground/70">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="mb-3 text-2xl font-semibold">Questions it answers</h2>
            <ul className="flex flex-col gap-2 text-foreground/80">
              <li>• What share of my revenue goes to AI providers?</li>
              <li>• Which plan loses money once AI is paid for?</li>
              <li>• What does a free trial cost me, and per converted trial?</li>
              <li>• Which paying users cost more than they pay?</li>
              <li>• Which model and which feature drive the bill?</li>
            </ul>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-foreground/5 p-4 text-xs leading-relaxed">
            <code>{`import { createMeter } from "fiscallm";

const meter = createMeter({ apiKey: env.FISCALLM_KEY });

const res = await openai.chat.completions.create({
  model, messages,
});
meter.trackOpenAI(res, { userId, feature: "chat" });`}</code>
          </pre>
        </section>

        <section>
          <h2 className="mb-6 text-2xl font-semibold">FAQ</h2>
          <dl className="grid gap-6 md:grid-cols-2">
            {QUESTIONS.map(([q, a]) => (
              <div key={q}>
                <dt className="font-medium">{q}</dt>
                <dd className="mt-1 text-sm text-foreground/70">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
