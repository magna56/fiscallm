# Roadmap

FiscaLLM is open source and free. This is the plan, including what we will only build if there is real demand, so nobody is surprised later. Last updated: 2026-10-18. Shipped changes are in [CHANGELOG.md](CHANGELOG.md).

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

## Next (in progress, in this order)
1. **Runnable example apps** (Next.js route handler, FastAPI endpoint) you can run locally and watch data flow end to end
2. **One-command self-hosting** with Docker Compose, and deploy buttons
3. **Stripe connector**, so apps that bill through Stripe can use FiscaLLM as easily as RevenueCat apps
4. **Accuracy report**: computed cost compared with real provider usage pages, published with the method

## Later, only if there is demand
| Stage | What we do | Only when |
|---|---|---|
| Signs of life | Team accounts | Any one: 300+ GitHub stars, 25+ active hosted apps, or 3+ people asking for it |
| Paid cloud | Optional paid plans for the hosted service (self-hosting stays free) | 10+ people say they would pay, or hosted usage outgrows the free fair-use limit |
| Teams and companies | SSO, audit logs, priority support | Companies ask for them |

If we introduce paid hosted plans, existing free users get advance notice, and anything already in the open-source code stays open source.

## Ideas, roughly in order
- Budget enforcement: a check endpoint so your backend can ask "may this user make another call?" (only if people say they want protection, not just reports)
- Spread annual-plan revenue across the months it covers
- Slack and webhook alert channels
- Adapty and Superwall webhooks
- Hosted proxy for apps with no backend
- Direct App Store and Google Play connections
- Per-user cost forecasts and pricing advice

Want something sooner? [Open an issue](https://github.com/magna56/fiscallm/issues) and tell us the problem you have.
