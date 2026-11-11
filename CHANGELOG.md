# Changelog

All notable changes. Newest first. Dates are when the change went live on fiscallm.com.

## 2026-11-10
- **Limits by plan** (SDKs 0.7.0): give `free`, `trial` and `paid` plans, or a single product ID, their own AI allowance in AI calls or dollars, per day, per month (UTC) or in total. `meter.check(userId)` and `POST /api/v1/check` now also return `plan`, `productId`, `limitsFrom` and `limits` (`period`, `unit`, `limit`, `used`, `remaining`, `resetsAt`), so an app can show "3 left today" and open the paywall at zero. The plan comes from RevenueCat or Stripe (no record is `free`; a subscription counts as paid for a day past its end date so a late renewal does not drop a paying user), or pass `{ plan }` yourself. The SDKs count each tracked call against the remembered answer at once. The new **Limits** page sets the limits and lists users who are at one. Existing `check` callers are unaffected: with no limits set, the answer is as before. [Docs](https://fiscallm.com/docs#plan-limits), [guide](https://fiscallm.com/guides/ai-usage-limits-by-plan).
- **OpenTelemetry**: point an OTLP/HTTP trace exporter at `https://fiscallm.com/api/v1/otel` with the ingest key in the `Authorization` header, and AI call spans that follow the GenAI semantic conventions (Vercel AI SDK, OpenLLMetry, OpenInference) become cost per user. No FiscaLLM SDK needed. JSON or protobuf, with or without gzip. The user comes from `user.id` on the span, a parent span or the resource. Tested end to end with AI SDK 7 and the official OTLP exporters. [Guide](https://fiscallm.com/integrations/opentelemetry), [Vercel AI SDK guide](https://fiscallm.com/integrations/vercel-ai-sdk).
- **LiteLLM**: a `generic_api` callback in the proxy config posts to `https://fiscallm.com/api/v1/litellm`. LiteLLM's own cost is stored as is; the user is the request's `user`. Tested with the open-source proxy 1.83.9. [Guide](https://fiscallm.com/integrations/litellm).
- **MCP server** at `https://fiscallm.com/api/mcp` (remote, Streamable HTTP, read-only). No key: `list_llm_prices`, `get_llm_price`, `estimate_llm_cost`, `compare_llm_costs`, `subscription_break_even`, `fiscallm_setup_guide`. With the app's key: `get_margin_overview`, `list_users_by_margin`, `get_plan_margins`, `get_cost_breakdown`. [Details](https://fiscallm.com/mcp).
- **LLM pricing API**, free and with no key: `GET /api/v1/prices`, `/api/v1/prices/<model>` and `/api/v1/estimate`. [Details](https://fiscallm.com/llm-pricing/api).
- **Read API**: `GET /api/v1/metrics/overview`, `/users`, `/plans` and `/breakdown` return the dashboard's numbers as JSON with the app's key. The HTTP API is described in [openapi.json](https://fiscallm.com/openapi.json).
- The `Authorization` header may carry the key with or without `Bearer`.

## 2026-11-07
- **SDKs 0.6.1**: README and package descriptions cover Stripe and other billing, not only RevenueCat. No code changes.
- **Vercel AI SDK example**: `examples/vercel-ai-sdk` reports usage from `generateText` and `streamText`. Thanks to [@virginiamwega2-svg](https://github.com/virginiamwega2-svg).

## 2026-11-02
- **Stripe is out of beta**: tested end to end against Stripe test clocks (trial, conversion, renewal, partial refund, lost disputes, cancellation). Saving a read-only key now gives Stripe's exact fee and counts payments in any currency your account settles in USD; lost disputes are subtracted like refunds. Fixed: tax on Stripe's newest API version (it moved to `total_taxes`) and test-clock payments dated in the simulated future.
- **Stripe history import**: paste a read-only Stripe restricted key on the Setup page to import the last 12 months of paid invoices, refunds, current trials and ended subscriptions. The key is used for the import only and never stored. An invoice is counted once whether it arrives by webhook or import, so re-running is safe.
- **Revenue CSV upload**: upload payments, renewals, refunds and trials from any billing system (Stripe, Paddle, Lemon Squeezy, a spreadsheet) as a CSV on the Setup page. Bad rows are reported by line number; re-uploading skips rows already stored.

## 2026-10-23
- **Connect RevenueCat**: one click on the Setup page. Approve access in RevenueCat and FiscaLLM adds its webhook to your project and imports your past subscribers, with nothing to copy or paste. Read-only for customer data; Disconnect removes the webhook and the tokens. Thanks to the RevenueCat team for the OAuth client. Self-hosted copies keep the manual setup unless they register their own client.
- **Caps that hold during an outage** (SDKs 0.6.0): if FiscaLLM is slow or down, `meter.check` keeps refusing a user it already refused, instead of letting them through. New `checkOnError: "deny"` (`check_on_error="deny"`) to fail closed for everyone, and `localLimit` (`local_limit=LocalLimit(...)`) to cap each user's calls, tokens or exact cost in your own process with no network call, which stops a runaway loop even when FiscaLLM is unreachable. Results now include `source`.
- **Jobs**: for apps that charge per job (credits held, then captured or returned). Tag AI calls with a `jobId` and report each job's status with `meter.trackJob({ jobId, userId, status })` (`track_job` in Python) or `POST /api/v1/jobs`. The new Jobs page shows the AI cost of refunded jobs and of jobs that never resolved, per user. SDKs 0.5.0.

## 2026-10-19
- **Spending caps**: mark a daily or 30-day per-user budget as Block, and call `meter.check(userId)` (TypeScript) or `meter.check(user_id)` (Python, `acheck` for async) before an AI call. It returns `allow: false` with a reason once the user reaches the amount, and fails open if FiscaLLM is slow or down. Also available as `POST /api/v1/check`. SDKs 0.4.0.
- **Slack alerts**: paste a Slack incoming-webhook URL as an alert's webhook.
- **Runaway-loop alert**: get alerted when one user uses more than N tokens in 5 minutes.

## 2026-10-18
- **Integrations page** listing what FiscaLLM connects to with a status for each, and the How it works page now covers Stripe, the monthly limit and the kill switch.
- **Accuracy**: audited the built-in prices against OpenAI, Anthropic and Google pricing pages (all matched), added eight legacy OpenAI models, and a per-model CSV export of Overview to compare with your provider. See ACCURACY.md.
- **Stripe connector (beta)**: connect Stripe from the Setup page (webhook + signing secret) to count paid invoices, trials, cancellations and refunds. USD only; what you keep is estimated with Stripe's standard fee.
- **Examples**: a sample-data script that fills the dashboard without any AI key, Next.js and FastAPI starting points, and a Deploy-with-Vercel button.
- **Sample data**: choose the number of users and history days, and use a seed to repeat the generated values. Thanks to [@yoreva-01](https://github.com/yoreva-01).
- **Tests** for streaming (`trackSSE`) edge cases: split JSON, comments, `[DONE]` and streams without usage. Thanks to [@Huang-404-Q](https://github.com/Huang-404-Q).
- **Kill switch** in both SDKs (0.3.2): set `FISCALLM_DISABLED=1`, or pass `disabled: true` / `disabled=True`, and the SDK does nothing at all.
- Public **roadmap** page and changelog page on the site.
- **CSV export** of the Users, Plans and Trials tables.
- New page: [What FiscaLLM covers and what it doesn't](https://fiscallm.com/coverage).
- Homepage dashboard preview is labelled "Sample data".
- Optional monthly event cap per app (`MONTHLY_EVENT_CAP`; the hosted service uses 100,000). Off by default for self-hosters.
- Email sender addresses are configurable (`EMAIL_FROM_ALERTS`, `EMAIL_FROM_REPORTS`).
- The project is open source (MIT) with a self-hosting guide, contributing guide and public roadmap.

## 2026-10-17
- Redesigned dashboard: sidebar, apps page, guided setup checklist.
- Public demo dashboard on sample data (`/demo`), engineering page (`/how-it-works`), and guides on tracking OpenAI and Anthropic cost per user and AI margin per user for RevenueCat apps.
- Sign-in links now point at fiscallm.com and work from any browser.
- Web analytics for public pages only (no cookies).

## 2026-10 (earlier)
- Revenue API for apps without RevenueCat (`trackRevenue` / `track_revenue`).
- Python SDK (0.3.0) and an AI setup skill.
- Budgets and alerts, weekly margin report by email, RevenueCat history import.
- Per-unit pricing for images, audio and video models.
- First version: ingest API, RevenueCat webhook, per-user, plan and trial margin dashboard, TypeScript SDK.
