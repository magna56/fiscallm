# Next.js example

One route handler, `app/api/chat/route.ts`, that calls OpenAI and reports usage to FiscaLLM.

1. Install: `npm install openai fiscallm @vercel/functions`
2. Copy `app/api/chat/route.ts` into your Next.js app.
3. Set `OPENAI_API_KEY` and `FISCALLM_KEY` (create an app in FiscaLLM and copy the ingest key from its Setup page).
4. Call it: `curl -X POST localhost:3000/api/chat -H 'content-type: application/json' -d '{"message":"Hello","userId":"test-user-1"}'`
5. Open the app in FiscaLLM. `test-user-1` appears under Users within a few seconds.

Not on Vercel? Remove `waitUntil` and call `await meter.flush()` before you return the response.
Self-hosting? Set `FISCALLM_ENDPOINT` to `https://your-domain/api/v1/events`.
Want to disable reporting without a deploy? Set `FISCALLM_DISABLED=1`.
