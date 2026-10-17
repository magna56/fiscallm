import type { Metadata } from "next";
import Link from "next/link";
import { DemoDashboard } from "@/components/demo-dashboard";
import { SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = {
  title: "Live demo · FiscaLLM",
  description: "Click around a FiscaLLM dashboard on sample data. No sign-up needed.",
};

export default function DemoPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f7fb]">
      <SiteHeader />
      <div className="border-b border-black/5 bg-white/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-2.5 text-sm">
          <span className="text-muted">Sample data. This is the dashboard you get, with your own users in it.</span>
          <Link href="/login" className="font-medium text-accent hover:underline">
            Start free →
          </Link>
        </div>
      </div>
      <DemoDashboard />
      <SiteFooter />
    </div>
  );
}
