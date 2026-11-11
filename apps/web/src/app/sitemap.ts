import type { MetadataRoute } from "next";
import { COMPETITORS } from "@/lib/compare";
import { modelPairs, pairSlug, TEXT_MODELS } from "@/lib/models";

const BASE = "https://fiscallm.com";

export const PAGES: [string, number][] = [
  ["/", 1],
  ["/demo", 0.9],
  ["/llm-pricing", 0.9],
  ["/llm-pricing/report", 0.8],
  ["/how-it-works", 0.8],
  ["/docs", 0.8],
  ["/integrations", 0.7],
  ["/integrations/opentelemetry", 0.8],
  ["/integrations/litellm", 0.8],
  ["/integrations/vercel-ai-sdk", 0.8],
  ["/mcp", 0.8],
  ["/llm-pricing/api", 0.8],
  ["/stripe", 0.9],
  ["/coverage", 0.7],
  ["/compare", 0.7],
  ["/changelog", 0.4],
  ["/roadmap", 0.5],
  ["/guides", 0.7],
  ["/guides/ai-usage-limits-by-plan", 0.9],
  ["/guides/track-openai-cost-per-user", 0.7],
  ["/guides/track-anthropic-claude-cost-per-user", 0.7],
  ["/guides/ai-margin-per-user-revenuecat", 0.8],
  ["/guides/ai-cost-per-customer-stripe", 0.8],
  ["/guides/ai-margin-from-revenue-csv", 0.8],
  ...COMPETITORS.map((c): [string, number] => [`/compare/fiscallm-vs-${c.slug}`, 0.6]),
  ...TEXT_MODELS.map((m): [string, number] => [`/llm-pricing/${m.slug}`, 0.6]),
  ...modelPairs().map(([a, b]): [string, number] => [`/llm-pricing/compare/${pairSlug(a.slug, b.slug)}`, 0.5]),
  ["/privacy", 0.3],
  ["/terms", 0.3],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.map(([path, priority]) => ({ url: `${BASE}${path}`, priority, lastModified }));
}
