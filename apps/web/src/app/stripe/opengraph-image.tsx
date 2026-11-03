import { OG_SIZE, ogCard } from "@/lib/og";

export const alt = "AI margin per customer for Stripe apps";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    eyebrow: "Stripe",
    title: "AI margin per customer, from Stripe",
    stats: [
      ["Stripe fee", "Exact"],
      ["Currencies", "Any"],
      ["Price", "Free, MIT"],
    ],
  });
}
