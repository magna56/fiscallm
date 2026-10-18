// A Next.js (App Router) route handler that answers a chat message with OpenAI
// and reports the cost to FiscaLLM. Drop it into your own app at app/api/chat/route.ts.
//
//   npm install openai fiscallm @vercel/functions
//
// Environment: OPENAI_API_KEY, FISCALLM_KEY (the ingest key from your app's Setup page).
// Self-hosting? Also set FISCALLM_ENDPOINT, e.g. https://your-domain/api/v1/events.
import { waitUntil } from "@vercel/functions"; // Vercel only; on other hosts remove it and call `await meter.flush()` before returning.
import { createMeter } from "fiscallm";
import OpenAI from "openai";

const openai = new OpenAI(); // reads OPENAI_API_KEY

export async function POST(request: Request) {
  // In a real app take the user ID from your own session (your auth), not from the request body.
  // If you use RevenueCat, it must be the RevenueCat app user ID, so costs line up with payments.
  const { message, userId } = (await request.json()) as { message: string; userId: string };

  // One meter per request: it reports in the background, after your response is sent.
  const meter = createMeter({ apiKey: process.env.FISCALLM_KEY, endpoint: process.env.FISCALLM_ENDPOINT, waitUntil });

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: message }],
  });

  // The one line FiscaLLM needs. It reads only the model name and token counts, never the text.
  meter.trackOpenAI(res, { userId, feature: "chat" });

  return Response.json({ reply: res.choices[0]?.message.content ?? "" });
}
