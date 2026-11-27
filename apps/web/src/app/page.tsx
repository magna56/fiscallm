import Link from "next/link";
import { Actions, CodeSection, HowItWorks, PlanLimits, Problem, SectionHead, Solution } from "@/components/app-sections";
import { DashboardPreview } from "@/components/dashboard-preview";
import { PricingPlanner } from "@/components/pricing-planner";
import { CONTACT, SiteFooter, SiteHeader } from "@/components/site";
import { calcModels } from "@/lib/models";

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://fiscallm.com/#org",
      name: "FiscaLLM",
      url: "https://fiscallm.com",
      logo: "https://fiscallm.com/icon.svg",
      email: CONTACT,
      sameAs: [
        "https://github.com/magna56/fiscallm",
        "https://www.npmjs.com/package/fiscallm",
        "https://pypi.org/project/fiscallm/",
        "https://www.producthunt.com/products/fiscallm",
        "https://www.linkedin.com/in/mayur-agnani/",
      ],
    },
    {
      "@type": "SoftwareApplication",
      name: "FiscaLLM",
      url: "https://fiscallm.com",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      description:
        "Free, open-source pricing and margin tools for apps and websites that call AI: a pricing planner, AI limits per plan, and the AI cost of each user against what they pay.",
      featureList: [
        "Pricing planner: margin per plan, heavy-user cost, safe free-tier limit",
        "AI limits per free, trial and paid plan with one check() before each call",
        "AI cost per user against revenue from RevenueCat, Stripe or a CSV",
        "Spending caps, budget alerts and a runaway-loop warning",
      ],
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      license: "https://opensource.org/licenses/MIT",
      codeRepository: "https://github.com/magna56/fiscallm",
      publisher: { "@id": "https://fiscallm.com/#org" },
    },
  ],
};

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col overflow-x-clip">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <SiteHeader />
      <main className="flex flex-col">
        <section className="mx-auto w-full max-w-6xl px-4 pt-20 text-center sm:px-6 sm:pt-28">
          <p className="shimmer text-sm font-medium">Free and open source, MIT · For apps and websites that call AI</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            Make sure every user <span className="text-gradient">pays for their AI.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            Plan prices and free-tier limits before you launch. After launch, enforce a limit per plan and see what each user costs you in AI
            against what they pay. No paid plans.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#planner" className="rounded-full bg-foreground px-6 py-3 font-medium text-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5">
              Plan your pricing
            </a>
            <Link href="/demo" className="glass rounded-full border border-black/10 px-6 py-3 font-medium transition hover:-translate-y-0.5">
              Try the demo
            </Link>
          </div>
        </section>

        <section id="planner" className="mx-auto w-full max-w-4xl scroll-mt-20 px-4 pt-20 sm:px-6">
          <SectionHead
            eyebrow="Step 1 · Before launch"
            title="What should you charge, and how much can you give away?"
            body="Pick a model, enter your plans. Runs in your browser, no sign-up."
          />
          <div className="mt-8">
            <PricingPlanner models={calcModels()} initial="gpt-5-mini" />
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pt-28 text-center sm:px-6">
          <SectionHead
            eyebrow="Step 2 · After launch"
            title="Your real users, against what they pay."
            body="One line after each AI call. Revenue from RevenueCat, Stripe or a CSV. Limits per plan, margin per user, alerts."
          />
          <Link
            href="/demo"
            aria-label="Open the live demo dashboard"
            className="product-frame relative mx-auto mt-10 block max-w-4xl overflow-hidden rounded-2xl border border-black/10 bg-white text-left shadow-xl shadow-indigo-500/10"
          >
            <DashboardPreview />
          </Link>
        </section>
        <Problem />
        <Solution />
        <PlanLimits />
        <HowItWorks />
        <Actions />
        <CodeSection />

        <section className="mx-auto mb-32 mt-24 w-full max-w-4xl px-4 sm:px-6">
          <div className="rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-muted">Also free: for engineering teams</p>
            <p className="mt-1 text-lg font-semibold">What Claude Code, Codex, Cursor and Gemini CLI cost, per developer.</p>
            <Link href="/for-teams" className="mt-3 inline-block text-sm font-medium text-accent underline">
              See FiscaLLM for teams →
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
