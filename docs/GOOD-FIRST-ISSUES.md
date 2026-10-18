# Good first issues (drafts)

Small, well-scoped tasks that help a lot. Each can be opened as an issue labelled `good first issue`. Ask in the issue before you start, so two people don't do the same thing.

## Data only (no code knowledge needed)
1. **Price embedding models.** `text-embedding-3-small`, `text-embedding-3-large` and others are currently "unpriced". Add rows to `packages/shared/src/pricing/prices.ts` from the provider's pricing page, and a test in `audit.test.ts`.
2. **Add popular open-model hosts.** Groq, Mistral, DeepSeek, Together and OpenRouter models are unpriced. Add the most-used ones with a link to each pricing page in a comment.
3. **Check speech, image and video unit prices.** The per-unit prices (`units`) were not part of the 2026-10-18 audit. Compare them with the provider pages and report or fix differences (see ACCURACY.md).

## Docs and examples
4. **A Cloudflare Workers example** next to `examples/nextjs` and `examples/fastapi` (use `ctx.waitUntil`).
5. **A plain HTTP example** (curl and Go) for the ingest and revenue APIs, in the docs.
6. **A Vercel AI SDK example** showing where to call `meter.track` with its usage object.

## Code
7. **Options and `--help` for `examples/send-sample-data.mjs`.** It only has `--dry-run`; add `--help`, `--users`, `--days` and `--seed`.
8. **More tests for `trackSSE`** with unusual chunk boundaries (split JSON across chunks, comments, `[DONE]`).
9. **Non-USD Stripe invoices.** The Stripe connector ignores them; convert using the invoice's own exchange data or document a clear fallback (discuss in the issue first).
10. **Check the per-unit prices** (speech, image, video) against the provider pages; they were not part of the 2026-10-18 audit (see ACCURACY.md).
