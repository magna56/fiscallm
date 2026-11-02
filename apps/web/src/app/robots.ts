import type { MetadataRoute } from "next";

const PRIVATE = ["/dashboard", "/account", "/welcome", "/auth", "/api/", "/lab"];

// Search engines and AI assistants are welcome on every public page; naming
// the AI crawlers makes that explicit for the ones that look for their own rule.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "DuckAssistBot",
  "meta-externalagent",
  "MistralAI-User",
  "cohere-ai",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: "https://fiscallm.com/sitemap.xml",
  };
}
