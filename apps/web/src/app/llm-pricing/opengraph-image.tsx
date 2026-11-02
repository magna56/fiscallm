import { OG_SIZE, ogCard } from "@/lib/og";
import { messageCost, TEXT_MODELS, usd } from "@/lib/models";

export const alt = "LLM API pricing compared: cost per message and per user";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  const costs = TEXT_MODELS.map((m) => messageCost(m.price));
  return ogCard({
    eyebrow: "Free calculator",
    title: "LLM API pricing, as cost per message and per user",
    stats: [
      ["Models", String(TEXT_MODELS.length)],
      ["Cheapest message", usd(Math.min(...costs))],
      ["Priciest message", usd(Math.max(...costs))],
    ],
  });
}
