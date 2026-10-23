# Changelog

All notable changes. Newest first. Dates are when the change went live on fiscallm.com.

## 2026-10-23
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
