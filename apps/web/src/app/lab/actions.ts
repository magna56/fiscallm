"use server";

import { createMeter } from "fiscallm";
import { requireUser } from "@/lib/auth";

// Test backend for step 9: a real AI call, reported with the published
// fiscallm SDK exactly as a customer's backend would. Sign-in only, so
// nobody else can spend the AI keys.

export interface AskResult {
  ok: boolean;
  text: string;
  model?: string;
  usage?: unknown;
}

export async function askAI(userId: string, provider: "gemini" | "openai", prompt: string): Promise<AskResult> {
  await requireUser();
  userId = userId.trim().slice(0, 100);
  prompt = prompt.trim().slice(0, 2000);
  if (!userId || !prompt) return { ok: false, text: "Enter a user ID and a prompt." };

  const meter = createMeter({ apiKey: process.env.FISCALLM_KEY });
  try {
    if (provider === "gemini") {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": process.env.gemini_key ?? "" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) return { ok: false, text: `Gemini error ${res.status}: ${json?.error?.message ?? ""}` };
      meter.trackGemini(json, { userId, feature: "lab" });
      return {
        ok: true,
        text: json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "",
        model: json.modelVersion,
        usage: json.usageMetadata,
      };
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.open_ai_key ?? ""}` },
      body: JSON.stringify({ model: "gpt-4.1-nano", messages: [{ role: "user", content: prompt }], max_tokens: 400 }),
    });
    const json = await res.json();
    if (!res.ok) return { ok: false, text: `OpenAI error ${res.status}: ${json?.error?.message ?? ""}` };
    meter.trackOpenAI(json, { userId, feature: "lab" });
    return { ok: true, text: json.choices?.[0]?.message?.content ?? "", model: json.model, usage: json.usage };
  } finally {
    // No waitUntil here, so send before the action returns.
    await meter.flush();
  }
}
