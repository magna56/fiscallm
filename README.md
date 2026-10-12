# FiscaLLM

See what each user costs you in AI, against what they pay.

## Layout

- `apps/web`: Next.js dashboard and landing page
- `apps/api`: Hono API (ingest and webhooks), deployed on Vercel
- `packages/sdk`: TypeScript SDK
- `packages/shared`: database schema and shared types

## Development

```sh
pnpm install
pnpm dev:web   # http://localhost:3000
pnpm dev:api   # http://localhost:8787/health
```

Copy `.env.example` to `apps/web/.env.local` and `packages/shared/.env` and fill in the values.

Database migrations:

```sh
pnpm db:generate
pnpm db:migrate
```
