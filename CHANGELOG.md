# Changelog

All notable changes. Newest first. Dates are when the change went live on fiscallm.com.

## 2026-10-18
- **Accuracy**: audited the built-in prices against OpenAI, Anthropic and Google pricing pages (all matched), added eight legacy OpenAI models, and a per-model CSV export of Overview to compare with your provider. See ACCURACY.md.
- **Stripe connector (beta)**: connect Stripe from the Setup page (webhook + signing secret) to count paid invoices, trials, cancellations and refunds. USD only; what you keep is estimated with Stripe's standard fee.
- **Examples**: a sample-data script that fills the dashboard without any AI key, Next.js and FastAPI starting points, and a Deploy-with-Vercel button.
- **Sample data**: choose the number of users and history days, and use a seed to repeat the generated values. Thanks to [@yoreva-01](https://github.com/yoreva-01).
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
