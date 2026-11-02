import { notFound } from "next/navigation";
import { COMPETITORS, findCompetitor } from "@/lib/compare";
import { OG_SIZE, ogCard } from "@/lib/og";

export const alt = "FiscaLLM compared";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: `fiscallm-vs-${c.slug}` }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const c = findCompetitor((await params).slug.replace(/^fiscallm-vs-/, ""));
  if (!c) notFound();
  return ogCard({
    eyebrow: "Compare",
    title: `FiscaLLM vs ${c.name}`,
    stats: [
      ["FiscaLLM price", "Free, MIT"],
      ["Self-hosting", "Yes"],
      ["Revenue", "RevenueCat, Stripe, CSV"],
    ],
  });
}
