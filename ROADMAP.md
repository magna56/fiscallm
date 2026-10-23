# Roadmap

FiscaLLM is open source and free. This is the plan, including what we will only build if there is real demand, so nobody is surprised later. Last updated: 2026-10-18. Shipped changes are in [CHANGELOG.md](CHANGELOG.md). Follow progress on the [public roadmap board](https://github.com/users/magna56/projects/1), vote with a 👍 on the [roadmap issues](https://github.com/magna56/fiscallm/issues?q=is%3Aissue+is%3Aopen+label%3Aroadmap), or suggest something in [Ideas](https://github.com/magna56/fiscallm/discussions/categories/ideas). This file is the source of truth; the board mirrors it.

## What is free, and stays free
- The SDKs (TypeScript and Python), MIT licensed.
- The server, dashboard, alerts, weekly report, RevenueCat webhook and import, and the revenue API: open source, self-hostable for free.
- The hosted service at fiscallm.com is free under fair use (up to 100,000 events per app per month), run by the maintainer on a best-effort basis.

## Done recently
- Open source (MIT), self-hosting guide, contributing guide
- Kill switch in both SDKs
- CSV export of Users, Plans and Trials
- "What FiscaLLM covers and what it doesn't" page
- Optional monthly event cap per app
- **Spending caps**: mark a per-user budget as Block and call `meter.check(userId)` (TypeScript and Python)
- **Caps that hold during an outage** (SDKs 0.6.0): a refused user stays refused while FiscaLLM is unreachable, `checkOnError: "deny"` to fail closed, and an in-process local limit that stops a runaway loop with no network call
- **Jobs**: tag AI calls with a `jobId` and report each job as pending, captured or refunded; see the cost of refunded and unresolved jobs per user (SDKs 0.5.0)
- **Slack alerts** and a **runaway-loop alert** (a user over N tokens in 5 minutes)
- **Price audit** against OpenAI, Anthropic and Google pricing pages (all matched; eight legacy OpenAI models added) and a per-model CSV to check your own numbers (ACCURACY.md)
- **Stripe connector (beta)**: payments, trials and refunds from a Stripe webhook, USD only; tested against sample payloads, real-world reports welcome
- Runnable examples: a sample-data script, Next.js and FastAPI starting points, and a deploy-to-Vercel button
- Public roadmap and changelog pages

## Next (in progress, in this order)
1. **Per-user downgrade**: a third setting on a budget, between Alert and Block. Past the amount, `meter.check` answers "downgrade" with the cheaper model you chose, so a heavy user keeps chatting on a cheaper model instead of being cut off mid-conversation or running up your bill
2. **Accuracy against real invoices**: the price audit is done (see ACCURACY.md); a multi-week comparison with a real app's provider invoices still needs real usage
3. **Docker Compose** for one-command self-hosting (waiting for a machine with Docker to test it properly; the Vercel button covers hosting meanwhile)

## Later, only if there is demand
| Stage | What we do | Only when |
|---|---|---|
| Signs of life | Team accounts | Any one: 300+ GitHub stars, 25+ active hosted apps, or 3+ people asking for it |
| Paid cloud | Optional paid plans for the hosted service (self-hosting stays free) | 10+ people say they would pay, or hosted usage outgrows the free fair-use limit |
| Teams and companies | SSO, audit logs, priority support | Companies ask for them |

If we introduce paid hosted plans, existing free users get advance notice, and anything already in the open-source code stays open source.

## Ideas, roughly in order
- Spread annual-plan revenue across the months it covers
- Adapty and Superwall webhooks
- Hosted proxy for apps with no backend
- Direct App Store and Google Play connections
- Per-user cost forecasts and pricing advice

Want something sooner? [Open an issue](https://github.com/magna56/fiscallm/issues) and tell us the problem you have.
