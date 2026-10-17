# Roadmap

FiscaLLM is open source and free. This is the plan, including what we will only build if there is real demand, so nobody is surprised later.

## What is free, and stays free
- The SDKs (TypeScript and Python), MIT licensed.
- The server, dashboard, alerts, weekly report, RevenueCat webhook and import, and the revenue API: open source, self-hostable for free.
- The hosted service at fiscallm.com is free under fair use, run by the maintainer on a best-effort basis.

## Stages, and what has to happen first

| Stage | What we do | Only when |
|---|---|---|
| 0. Now | Open source, free hosted service, find the first users | |
| 1. Signs of life | Stripe connector, team accounts, CSV export | Any one: 300+ GitHub stars, 25+ active hosted apps, or 3+ people asking for Stripe |
| 2. Paid cloud | Optional paid plans for the hosted service (self-hosting stays free) | 10+ people say they would pay, or hosted usage outgrows the free fair-use limit |
| 3. Teams and companies | SSO, audit logs, priority support | Companies ask for them |

If we introduce paid hosted plans, existing free users get advance notice, and anything already in the open-source code stays open source.

## Ideas, roughly in order
- Budget enforcement: a check endpoint so your backend can ask "may this user make another call?" (only if people say they want protection, not just reports)
- Spread annual-plan revenue across the months it covers
- Slack and webhook alert channels
- Adapty and Superwall webhooks
- Hosted proxy for apps with no backend
- Direct App Store and Google Play connections
- Per-user cost forecasts and pricing advice

Want something sooner? Open an issue and tell us the problem you have.
