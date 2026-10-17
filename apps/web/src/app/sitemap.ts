import type { MetadataRoute } from "next";

const BASE = "https://fiscallm.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number][] = [
    ["/", 1],
    ["/demo", 0.9],
    ["/how-it-works", 0.8],
    ["/docs", 0.8],
    ["/privacy", 0.3],
    ["/terms", 0.3],
  ];
  return pages.map(([path, priority]) => ({ url: `${BASE}${path}`, priority }));
}
