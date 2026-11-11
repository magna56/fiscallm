# fiscallm

Limit AI usage by subscription plan, and track the AI cost of each user of your app against their subscription revenue from RevenueCat, Stripe or any billing system. Zero dependencies, Python 3.9+.

The SDK never sits in the path of your AI calls: tracking only queues an event, a background thread sends batches, and it never raises. Prompts and responses are never sent, only token counts.

```sh
pip install fiscallm
```

```python
import os
from fiscallm import Meter

meter = Meter(api_key=os.environ["FISCALLM_KEY"])  # one per process

# user_id: the same ID your billing knows the user by (RevenueCat app user ID,
# or metadata.user_id on the Stripe subscription).
res = openai_client.chat.completions.create(model=model, messages=messages)
meter.track_openai(res, user_id=user_id, feature="chat")

meter.track_anthropic(message, user_id=user_id)
meter.track_gemini(result, user_id=user_id)

# Streams (sync or async): iterate the returned stream.
stream = meter.track_stream(
    openai_client.chat.completions.create(model=model, messages=messages, stream=True,
                                          stream_options={"include_usage": True}),
    user_id=user_id,
)

# Priced per unit (FiscaLLM knows the price): minutes, seconds, characters, images
meter.track(user_id=user_id, provider="openai", model="whisper-1", units=12.5, unit="minute")
meter.track(user_id=user_id, provider="google", model="veo-3.1-fast-generate-preview",
            units=8, unit="second", variant="1080p")

# Anything else: the exact cost
meter.track(user_id=user_id, provider="fal", model="flux-pro", cost_usd=0.05)

# Not on RevenueCat or Stripe? Report payments yourself:
meter.track_revenue(id=invoice_id, user_id=user_id, type="renewal", amount_usd=9.99, fee_pct=0.15)

# Pay-per-job apps (credits held, then charged or returned): tag the job's
# calls, report the outcome, and the Jobs page shows the cost of refunded
# or never-resolved jobs per user. Track a failed job's cost too if the
# provider still billed it.
meter.track_job(job_id=job_id, user_id=user_id, status="pending")
meter.track(user_id=user_id, provider="fal", model="veo-3", units=15, unit="second", job_id=job_id)
meter.track_job(job_id=job_id, user_id=user_id, status="captured")   # or "refunded"

# Serverless (AWS Lambda, Cloud Functions): before returning
meter.flush()          # or: await meter.aflush()
```

## Limits by plan

Give each plan its own AI allowance on the app's Limits page (for example `free`: 10 AI calls a day; `pro_monthly`: 500 a month; `paid`: $8 of AI a month). FiscaLLM knows each user's plan from RevenueCat or Stripe. Ask before each AI call:

```python
r = meter.check(user_id)            # await meter.acheck(user_id) in async code
if not r.allow:
    return paywall(plan=r.plan, resets_at=r.limits[0].resets_at if r.limits else None)

res = client.chat.completions.create(model=model, messages=messages)
meter.track_openai(res, user_id=user_id)
remaining = r.limits[0].remaining - 1 if r.limits else None   # "3 left today"
```

Each entry of `r.limits` has `period` (`"day"`, `"month"` or `"total"`), `unit` (`"requests"` or `"usd"`), `limit`, `used`, `remaining` and `resets_at`. Your own plan names: `meter.check(user_id, plan="team")`. The answer is cached for 5 seconds, and each tracked call is counted against it at once. [Docs](https://fiscallm.com/docs#plan-limits)

OpenAI-compatible APIs work with `meter.track_openai(res, user_id=user_id, provider="groq")`.

Docs: https://fiscallm.com/docs
