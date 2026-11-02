import { notFound } from "next/navigation";
import { OG_SIZE, ogCard } from "@/lib/og";
import { breakEven, findModel, messageCost, perM, PLAN, TEXT_MODELS, usd } from "@/lib/models";

export const alt = "LLM pricing: cost per message and per user";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return TEXT_MODELS.map((m) => ({ model: m.slug }));
}

export default async function Image({ params }: { params: Promise<{ model: string }> }) {
  const m = findModel((await params).model);
  if (!m) notFound();
  return ogCard({
    eyebrow: `LLM pricing · ${m.providerName}`,
    title: `${m.name}: what one user really costs`,
    stats: [
      ["Per 1M tokens in / out", `${perM(m.price.input)} / ${perM(m.price.output)}`],
      ["Per chat message", usd(messageCost(m.price))],
      [`Break-even on $${PLAN.price}`, `${breakEven(m.price).toLocaleString("en-US")} msgs`],
    ],
  });
}
