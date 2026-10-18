# FiscaLLM

**See the AI cost of every single user.** FiscaLLM matches each user's AI cost to what they pay you, so you can see margin per user, plan and free trial, and which model or feature drives the bill.

**Open source (MIT) and free.** Use the hosted service at [fiscallm.com](https://fiscallm.com) (free under fair use, best effort), or [run your own](SELF-HOSTING.md).

[Live demo (no sign-up)](https://fiscallm.com/demo) · [Docs](https://fiscallm.com/docs) · [How it works](https://fiscallm.com/how-it-works) · [Self-hosting](SELF-HOSTING.md) · [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md)

## The problem

AI apps charge a flat price but pay a variable cost. One user costs $0.20 a month in AI, another costs $25. Your AI provider's bill shows tokens, your subscription tool shows payments, and neither shows the user.

## How it works

```ts
import { createMeter } from "fiscallm";

const meter = createMeter({ apiKey: process.env.FISCALLM_KEY, waitUntil });

const res = await openai.chat.completions.create({ model, messages });
meter.trackOpenAI(res, { userId, feature: "chat" });
```

```python
from fiscallm import Meter

meter = Meter(api_key=os.environ["FISCALLM_KEY"])
res = client.chat.completions.create(model=model, messages=messages)
meter.track_openai(res, user_id=user_id, feature="chat")
```

- The SDK reads **only the model name and token counts** from the response. Never prompts or answers.
- Events are batched and sent in the background. Tracking never throws and never blocks your response.
- Each event has a client-generated UUID, so retries cannot double count.
- Revenue comes from a RevenueCat webhook, or from your own code with `trackRevenue` / `track_revenue`.
- Both are joined on the user ID. RevenueCat aliases are resolved, so anonymous and logged-in users merge.

Cost is priced on arrival: exact `costUsd` if given, otherwise per-token (input, output, cache read and cache write priced separately) or per-unit (images, audio, video) from a price table. Unknown models are flagged as unpriced, never counted as zero.

Net revenue is `price × (1 − tax − store commission)`.

## Layout

| Path | What it is |
|---|---|
| `apps/web` | Next.js site and dashboard |
| `apps/api` | Hono API: ingest, RevenueCat webhook, revenue API, cron jobs |
| `packages/shared` | Drizzle schema, pricing, metrics, alerts |
| `packages/sdk` | TypeScript SDK (`fiscallm` on npm) |
| `packages/sdk-python` | Python SDK (`fiscallm` on PyPI) |

Stack: TypeScript, Next.js, Hono, Postgres (Supabase) with Drizzle, hosted on Vercel.

## Limits

- It needs a backend between your app and the AI provider. Apps that call a provider straight from the phone are not covered yet.
- Revenue comes from RevenueCat or the revenue API. Direct App Store and Google Play connections are not built yet.

## Try it in ten minutes

- No AI key needed: create an app, then `FISCALLM_KEY=fsk_... node examples/send-sample-data.mjs` fills the dashboard with sample users (one heavy user who loses money).
- Copy-paste starting points for [Next.js](examples/nextjs) and [FastAPI](examples/fastapi), see [examples](examples).
- Run your own copy: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmagna56%2Ffiscallm&project-name=fiscallm&repository-name=fiscallm&env=DATABASE_URL,NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,CRON_SECRET,PUBLIC_URL&envDescription=Supabase%20connection%20details%2C%20a%20random%20CRON_SECRET%20and%20your%20public%20URL&envLink=https%3A%2F%2Fgithub.com%2Fmagna56%2Ffiscallm%2Fblob%2Fmain%2FSELF-HOSTING.md) (create a Supabase project first, see [SELF-HOSTING.md](SELF-HOSTING.md)).

## Development

```sh
pnpm install
pnpm dev:web   # http://localhost:3000
pnpm dev:api   # http://localhost:8787/api/health
pnpm test
```

Copy `.env.example` to `apps/web/.env.local` and `packages/shared/.env` and fill in the values.

```sh
pnpm db:generate
pnpm db:migrate
```

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first (it includes a short contributor agreement). The plan, including what we only build if there is demand, is in [ROADMAP.md](ROADMAP.md).

## License

MIT. See [LICENSE](LICENSE).
