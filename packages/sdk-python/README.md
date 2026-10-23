# fiscallm

Track the AI cost of each user of your app against their subscription revenue. Zero dependencies, Python 3.9+.

The SDK never sits in the path of your AI calls: tracking only queues an event, a background thread sends batches, and it never raises. Prompts and responses are never sent, only token counts.

```sh
pip install fiscallm
```

```python
import os
from fiscallm import Meter

meter = Meter(api_key=os.environ["FISCALLM_KEY"])  # one per process

# user_id must be the user's RevenueCat app user ID.
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

# No RevenueCat? Report payments yourself:
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

OpenAI-compatible APIs work with `meter.track_openai(res, user_id=user_id, provider="groq")`.

Docs: https://fiscallm.com/docs
