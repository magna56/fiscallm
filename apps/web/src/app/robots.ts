import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/account", "/welcome", "/auth", "/api/"] },
    sitemap: "https://fiscallm.com/sitemap.xml",
  };
}
