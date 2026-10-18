# Accuracy

FiscaLLM computes cost as **token counts × list prices**. It does not read your invoice. This page says what has been checked, what has not, and how to check it yourself.

## Price audit (2026-10-18)

I compared every price in the built-in table with the provider's own pricing page, including cache read and write rates and the long-prompt tiers. Sources: [OpenAI](https://developers.openai.com/api/docs/pricing), [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing), [Google](https://ai.google.dev/gemini-api/docs/pricing).

| Provider | Compared | Result |
|---|---|---|
| OpenAI | 40 text models on the page, with the over-272K-token tiers | 32 matched exactly. The other 8 were legacy models we did not carry (GPT-4, GPT-4 Turbo, the GPT-3.5 family, davinci-002, babbage-002); they are added now. |
| Anthropic | 15 current Claude models, with cache read and write prices | All matched exactly, including Haiku 5.5's two prompt-length tiers (up to and over 100,000 tokens). Retired models (Opus 4 and 4.1, Sonnet 4, Haiku 3.5) and the limited-availability Mythos models are not in the table. |
| Google | 10 Gemini text models, with prompt-size tiers and Google's announced price increases for December 2026 and January 2027 | All matched exactly. |

Spot checks of these prices run as tests (`packages/shared/src/pricing/audit.test.ts`).

## Not checked

- Prices for speech, image, video and audio-input models (the per-unit prices).
- Google cache storage fees, and prices that differ by modality inside one model.
- Models from other providers (Groq, Mistral, DeepSeek and so on). They show as **unpriced** until you set a price or pass `costUsd`.
- Whether the prices on those pages match what your invoice actually charges. See below.

## Known differences from a real invoice

These are things FiscaLLM does not apply, so expect your invoice to differ by roughly the share of your traffic they touch:

- **Batch, flex, fast or priority tiers.** Batch is about half price at some providers. Set a percentage discount in Settings if all of a model's traffic is batch.
- **Regional or data-residency uplifts**, for example OpenAI's regional endpoints (about +10%) and Anthropic's US-only inference (+10%).
- **Anthropic 1-hour cache writes** are priced as 5-minute writes.
- **Committed-use or enterprise discounts, free credits and taxes.**
- **Promotional prices** (for example a launch promotion on a model) are not tracked; the list price is used.
- **Calls you did not report**, failed calls the provider still billed, and retries you did not report. See [what's covered](https://fiscallm.com/coverage).

## Check it yourself in ten minutes

1. In FiscaLLM, open your app's **Overview**, choose the same date range as your provider's usage page, and click **Download CSV** on "Cost by model". The file has one row per model with its cost and any unpriced requests.
2. On your provider's usage or cost page, export or note the cost per model for the same range (the OpenAI and Anthropic consoles both show usage and cost by model).
3. Compare per model. Differences under a few percent usually mean one of the items above. Large differences usually mean unreported calls (agents, retries) or unpriced models.
4. If a price in our table is wrong, [open an issue](https://github.com/magna56/fiscallm/issues) with the provider's page link; a fix is a new dated row in `packages/shared/src/pricing/prices.ts`.

## Real-world comparison

A comparison of computed cost against real provider invoices over several weeks has **not been published yet**. It needs a real app with real usage. If you run FiscaLLM on one and are willing to share an anonymised comparison, please open an issue; it is the most useful contribution to this page.
