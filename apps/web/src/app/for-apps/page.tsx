import type { Metadata } from "next";
import Link from "next/link";
import { Actions, CodeSection, HowItWorks, PlanLimits, Problem, Solution } from "@/components/app-sections";
import { DashboardPreview } from "@/components/dashboard-preview";
import { SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = {
  title: "AI cost per user and limits by plan · FiscaLLM",
  description:
    "For apps that call AI: what each user costs you in AI against what they pay, AI limits per free, trial and paid plan, and alerts. Free and open source.",
  alternates: { canonical: "/for-apps" },
};

export default function ForApps() {
  return (
    <div className="flex min-h-full flex-1 flex-col overflow-x-clip">
      <SiteHeader />
      <main className="flex flex-col">
        <section className="mx-auto w-full max-w-6xl px-6 pt-20 text-center sm:pt-28">
          <p className="shimmer text-sm font-medium">For apps that call AI</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            What each user costs you in AI, <span className="text-gradient">against what they pay.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            One line after each AI call in your backend. Revenue from RevenueCat, Stripe or a CSV. Then limits per plan, margin per user and alerts
            when someone costs more than they pay. Free and open source.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="rounded-full bg-foreground px-6 py-3 font-medium text-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5">
              Start free
            </Link>
            <Link href="/demo" className="glass rounded-full border border-black/10 px-6 py-3 font-medium transition hover:-translate-y-0.5">
              Try the demo
            </Link>
          </div>
          <Link
            href="/demo"
            aria-label="Open the live demo dashboard"
            className="product-frame relative mx-auto mt-14 block max-w-4xl overflow-hidden rounded-2xl border border-black/10 bg-white text-left shadow-xl shadow-indigo-500/10"
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
        <div className="mb-32" />
      </main>
      <SiteFooter />
    </div>
  );
}
