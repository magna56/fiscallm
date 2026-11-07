# Vercel AI SDK example

This Next.js App Router example reports token usage to FiscaLLM using the Vercel AI SDK.

## Setup

Install the dependencies in your Next.js app: `npm install ai @ai-sdk/openai fiscallm @vercel/functions`

Copy `app/api/chat/route.ts` into your app at the same path.

Set these environment variables:

- `OPENAI_API_KEY`: your OpenAI API key.
- `FISCALLM_KEY`: your FiscaLLM ingest key.
- `FISCALLM_ENDPOINT`: optional; set this when self-hosting FiscaLLM.

## Generate text

Send a POST request to `/api/chat` with this JSON body: `{"message":"Hello","userId":"test-user-1"}`

## Stream text

To stream the response, set `mode` to `stream`: `{"message":"Hello","userId":"test-user-1","mode":"stream"}`

The route uses `meter.track()` with usage from `generateText` or the completed `streamText` response. Vercel's `waitUntil` allows usage reporting to continue in the background.

In production, derive `userId` from your authenticated session rather than accepting it directly from the request body.
