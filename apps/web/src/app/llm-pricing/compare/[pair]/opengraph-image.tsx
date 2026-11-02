import { notFound } from "next/navigation";
import { OG_SIZE, ogCard } from "@/lib/og";
import { breakEven, messageCost, modelPairs, pairSlug, parsePair, PLAN, usd } from "@/lib/models";

export const alt = "LLM pricing comparison: cost per message and per user";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return modelPairs().map(([a, b]) => ({ pair: pairSlug(a.slug, b.slug) }));
}

export default async function Image({ params }: { params: Promise<{ pair: string }> }) {
  const pair = parsePair((await params).pair);
  if (!pair) notFound();
  const [a, b] = pair;
  return ogCard({
    eyebrow: "LLM pricing compared",
    title: `${a.name} vs ${b.name}`,
    stats: [
      [`${a.name} per message`, usd(messageCost(a.price))],
      [`${b.name} per message`, usd(messageCost(b.price))],
      [`Break-even on $${PLAN.price}`, `${breakEven(a.price).toLocaleString("en-US")} vs ${breakEven(b.price).toLocaleString("en-US")}`],
    ],
  });
}
