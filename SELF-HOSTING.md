# Self-hosting FiscaLLM

FiscaLLM is two small apps that share one Postgres database:

- `apps/web`: the site and dashboard (Next.js)
- `apps/api`: the ingest API, RevenueCat webhook, revenue API and cron jobs (Hono)

In production both sit behind **one domain**: requests to `/api/*` go to the API, everything else goes to the web app. `vercel.json` does this on Vercel. Any host works if you recreate that routing.

Self-hosting is free and always will be. The hosted service at fiscallm.com is run by the author on a best-effort basis; see the README.

Fastest route: create the Supabase project (step 1 below), then click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmagna56%2Ffiscallm&project-name=fiscallm&repository-name=fiscallm&env=DATABASE_URL,NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,CRON_SECRET,PUBLIC_URL&envDescription=Supabase%20connection%20details%2C%20a%20random%20CRON_SECRET%20and%20your%20public%20URL&envLink=https%3A%2F%2Fgithub.com%2Fmagna56%2Ffiscallm%2Fblob%2Fmain%2FSELF-HOSTING.md)

and paste the five values it asks for. To see data right away, run `node examples/send-sample-data.mjs` (see [examples](examples)).

## What you need

- Node 20+ and pnpm (`npx pnpm@12.11.2` works if pnpm is not installed)
- A [Supabase](https://supabase.com) project (free tier is fine). It provides Postgres and the email sign-in. The app reads `auth.users`, so Supabase Auth is required.
- Optional: a [Resend](https://resend.com) account for weekly reports and alert emails
- A host for the two apps (Vercel is what we use)

## 1. Create the database and auth

1. Create a Supabase project.
2. Project Settings, API: copy the project URL and the **publishable** key.
3. Project Settings, Database, Connection string: copy the **transaction pooler** string (port 6543). Replace the password placeholder.
4. Authentication, URL Configuration: set **Site URL** to your public origin, and add `https://your-domain/auth/callback` and `https://your-domain/auth/confirm` as redirect URLs.
5. Authentication, Emails: in the **Magic link** template use the link
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink`
   and in **Confirm sign up** use
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`.
   (The built-in Supabase email sender is rate-limited; add your own SMTP under Emails, SMTP Settings for real use.)

## 2. Configure

```sh
git clone https://github.com/magna56/fiscallm.git
cd fiscallm
pnpm install
cp .env.example apps/web/.env.local   # then edit
cp .env.example apps/api/.env
cp .env.example packages/shared/.env
```

See `.env.example` for every variable. `CRON_SECRET` can be any long random string (`openssl rand -hex 32`). Set the same value for web and api.

## 3. Create the tables and the price list

```sh
pnpm db:migrate
pnpm --filter @fiscallm/shared db:sync-prices
```

The second command loads model prices (tokens and per-unit) into the database. Re-run it whenever you update `packages/shared/src/pricing/prices.ts`.

## 4. Run it locally

```sh
pnpm dev:web   # http://localhost:3000
pnpm dev:api   # http://localhost:8787/api/health
```

Locally the two apps run on different ports. Point the SDK at the API with its `endpoint` option:

```ts
createMeter({ apiKey: process.env.FISCALLM_KEY, endpoint: "http://localhost:8787/api/v1/events" });
```

```python
Meter(api_key=os.environ["FISCALLM_KEY"], endpoint="http://localhost:8787/api/v1/events")
```

## 5. Deploy

### Vercel (what we use)
1. Import the repo. The root `vercel.json` defines the two services and the routing.
2. Add the environment variables from `.env.example` to the project.
3. Add your domain, and set `PUBLIC_URL` to it.
4. Cron jobs are already in `vercel.json`: `/api/cron/daily` (07:00 UTC: retention and alerts) and `/api/cron/weekly-report` (Mondays 08:00 UTC). Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.

### Anywhere else
- Run `apps/web` (`pnpm --filter web build && pnpm --filter web start`) and `apps/api` (Hono on Node, see `apps/api/src/dev.ts`) behind one reverse proxy that sends `/api/*` to the API and the rest to the web app.
- Schedule two HTTP GET requests with `Authorization: Bearer <CRON_SECRET>`:
  `/api/cron/daily` once a day and `/api/cron/weekly-report` once a week.
- Use the Supabase transaction pooler. The app disables prepared statements for it, and never runs parallel queries on one connection.

## 6. Connect your app

1. Open your instance, sign in, create an app, copy the ingest key (shown once).
2. Install the SDK (`npm install fiscallm` or `pip install fiscallm`) and set `endpoint` to `https://your-domain/api/v1/events`.
3. For revenue, paste the webhook URL and authorization value from the app's Setup page into RevenueCat, or send revenue yourself with the revenue API.

## Optional: a monthly event cap

By default there is no limit. To protect a small database or a free hosting tier, set `MONTHLY_EVENT_CAP` (for example `100000`). Each app may then send that many events per calendar month (UTC). Beyond it the ingest API answers `403` with a clear message and the SDKs print it once; counting restarts on the 1st. The count is cached for a minute, so the cap can overshoot slightly. The Setup page shows usage as an app nears the limit.

## Updating

```sh
git pull && pnpm install && pnpm db:migrate
```

Migrations are additive. Back up the database before upgrading anyway.

## Privacy and operation

- Raw AI events are deleted after 90 days by the daily job. Daily totals are kept.
- The SDK sends only the user ID, model, token or unit counts, an optional feature label and a timestamp. Never prompts or answers.
- You are responsible for the data you collect. If you serve other people, publish your own privacy policy.

## Troubleshooting

- **Sign-in link does nothing:** check the redirect URLs and the email template links above.
- **No emails:** set `RESEND_API_KEY`, verify a sending domain in Resend, and set `EMAIL_FROM_ALERTS` and `EMAIL_FROM_REPORTS` to addresses on it. The defaults use fiscallm.com, which only the hosted service can send from.
- **Hangs under load:** use the Supabase transaction pooler (port 6543), not the direct connection.
