import { GUIDE_LINKS } from "@/lib/llms";

const BASE = "https://fiscallm.com";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function GET() {
  const items = GUIDE_LINKS.map(
    ([path, title, about]) =>
      `<item><title>${esc(title)}</title><link>${BASE}${path}</link><guid>${BASE}${path}</guid><description>${esc(`Covers ${about}.`)}</description></item>`,
  ).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>FiscaLLM guides</title><link>${BASE}/guides</link><description>Practical guides on AI cost per user and protecting your margins.</description>${items}</channel></rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
