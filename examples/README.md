# Examples

Three ways to see FiscaLLM working in about ten minutes. Create an app in FiscaLLM first and copy its ingest key (shown once, on the Setup page). Use a separate test app for these.

| Example | What it shows | Needs an AI key? |
|---|---|---|
| [`send-sample-data.mjs`](send-sample-data.mjs) | Fills the dashboard with six made-up users (one heavy user who loses money) and some payments. | No |
| [`nextjs/`](nextjs) | A route handler that calls OpenAI and reports usage. | Yes (OpenAI) |
| [`fastapi/`](fastapi) | A FastAPI endpoint that calls OpenAI and reports usage. | Yes (OpenAI) |

Quick start with no AI key:

```sh
FISCALLM_KEY=fsk_your_key node examples/send-sample-data.mjs
```

Self-hosting? Add `FISCALLM_ENDPOINT=http://localhost:8787/api/v1/events` (or your own domain). Add `--dry-run` to see what would be sent without sending anything.
