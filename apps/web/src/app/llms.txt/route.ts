import { llmsTxt } from "@/lib/llms";

export function GET() {
  return new Response(llmsTxt(), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
