import { waitUntil } from "@vercel/functions";
import { openai } from "@ai-sdk/openai";
import { generateText, streamText } from "ai";
import { createMeter } from "fiscallm";

const modelId = "gpt-4o-mini";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    message?: unknown;
    userId?: unknown;
    mode?: unknown;
  };

  if (
    typeof body.message !== "string" ||
    !body.message.trim() ||
    typeof body.userId !== "string" ||
    !body.userId.trim()
  ) {
    return Response.json(
      { error: "message and userId are required." },
      { status: 400 },
    );
  }

  const mode = body.mode ?? "generate";

  if (mode !== "generate" && mode !== "stream") {
    return Response.json(
      { error: 'mode must be "generate" or "stream".' },
      { status: 400 },
    );
  }

  const message = body.message;
  const userId = body.userId;

  // In production, get userId from your authenticated session.
  const meter = createMeter({
    apiKey: process.env.FISCALLM_KEY,
    endpoint: process.env.FISCALLM_ENDPOINT,
    waitUntil,
  });

  if (mode === "stream") {
    const result = streamText({
      model: openai(modelId),
      prompt: message,
      onEnd({ totalUsage }) {
        meter.track({
          userId,
          provider: "openai",
          model: modelId,
          inputTokens: totalUsage.inputTokens,
          outputTokens: totalUsage.outputTokens,
          feature: "chat-stream",
        });
      },
    });

    return result.toTextStreamResponse();
  }

  const result = await generateText({
    model: openai(modelId),
    prompt: message,
  });

  meter.track({
    userId,
    provider: "openai",
    model: modelId,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    feature: "chat",
  });

  return Response.json({ reply: result.text });
}
