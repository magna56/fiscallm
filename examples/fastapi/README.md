# FastAPI example

One endpoint, `POST /chat`, that calls OpenAI and reports usage to FiscaLLM.

1. `pip install -r requirements.txt`
2. `export OPENAI_API_KEY=... FISCALLM_KEY=...` (the ingest key is on your app's Setup page in FiscaLLM)
3. `uvicorn main:app --reload`
4. `curl -X POST localhost:8000/chat -H 'content-type: application/json' -d '{"message":"Hello","user_id":"test-user-1"}'`
5. Open the app in FiscaLLM. `test-user-1` appears under Users within a few seconds.

In AWS Lambda or Cloud Functions call `meter.flush()` before returning. Self-hosting? Set `FISCALLM_ENDPOINT`.
Want to disable reporting without a deploy? Set `FISCALLM_DISABLED=1`.
