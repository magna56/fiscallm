import { readFile } from "node:fs/promises";
import path from "node:path";
import { llmsTxt, priceTableMarkdown } from "@/lib/llms";

// Built once, so the file is read at build time, not from a serverless function.
async function fullText() {
  "use cache";
  // The setup skill is the most complete how-to; drop its frontmatter.
  const skill = await readFile(path.join(process.cwd(), "public/skill.md"), "utf8")
    .then((s) => s.replace(/^---[\s\S]*?---\n/, ""))
    .catch(() => "Setup instructions: https://fiscallm.com/skill.md\n");
  return `${llmsTxt()}\n${priceTableMarkdown()}\n${skill}`;
}

export async function GET() {
  return new Response(await fullText(), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
