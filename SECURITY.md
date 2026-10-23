# Security

## Reporting a vulnerability
Please do not open a public issue. Email **theaicommit@gmail.com** with what you found and how to reproduce it. We aim to reply within a few days, fix confirmed problems promptly, and credit you if you want.

## What matters most here
FiscaLLM handles revenue data and per-user usage, so these are the areas we most want reports on:
- Reading or changing another account's data (every query is scoped by app ID and owner).
- Ingest keys, webhook secrets, the Stripe signing secret and RevenueCat OAuth tokens (stored hashed or encrypted; never logged).
- The "Connect RevenueCat" OAuth flow (state and PKCE checks, binding the callback to the signed-in owner's app).
- Webhook verification (RevenueCat authorization header, Stripe signature) and replay handling.
- Anything that would make the SDK read or send prompts or responses (it must only read the model name and token counts).

## Supported versions
The latest release of the SDKs and the code on `main`.
