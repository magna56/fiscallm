import type { ModelPrice, Rates } from "./cost";

// List prices, USD per million tokens, standard tier, text tokens.
// Sources, checked 2026-10-16:
//   https://developers.openai.com/api/docs/pricing
//   https://platform.claude.com/docs/en/about-claude/pricing
//   https://ai.google.dev/gemini-api/docs/pricing
// To change a price, add a row with a new effectiveFrom; never edit an old
// one, so events keep the price that applied when they happened.
// Not covered: batch, fast mode, regional uplifts, Anthropic 1h cache
// writes (priced as 5m writes), Gemini audio input and cache storage.

// The date a price was first recorded here, not when the provider set it.
const LISTED = "2024-01-01";

type Row = [model: string, input: number, cached: number | null, output: number];

function rows(
  provider: string,
  list: Row[],
  extra: Partial<Pick<ModelPrice, "effectiveFrom" | "cacheWrite">> = {},
): ModelPrice[] {
  return list.map(([model, input, cached, output]) => ({
    provider,
    model,
    effectiveFrom: LISTED,
    input,
    output,
    ...(cached === null ? {} : { cached }),
    ...extra,
  }));
}

function withLong(rows: ModelPrice[], threshold: number, long: Record<string, Rates>) {
  return rows.map((r) => (long[r.model] ? { ...r, long: { threshold, ...long[r.model]! } } : r));
}

const r = (input: number, cached: number | null, output: number, cacheWrite?: number): Rates => ({
  input,
  output,
  ...(cached === null ? {} : { cached }),
  ...(cacheWrite === undefined ? {} : { cacheWrite }),
});

// OpenAI: prompts over 272K tokens use the long rates.
const openai = withLong(
  rows("openai", [
    ["gpt-6-astra", 10, 1, 50],
    ["gpt-6.1-sol", 2, 0.1, 10],
    ["gpt-6-sol", 2, 0.2, 10],
    ["gpt-6-luna", 0.1, 0.01, 0.5],
    ["gpt-5.6-sol", 4, 0.4, 20],
    ["gpt-5.6-terra", 2, 0.2, 12],
    ["gpt-5.6-luna", 0.2, 0.02, 1.2],
    ["gpt-5.5", 5, 0.5, 30],
    ["gpt-5.5-pro", 30, null, 180],
    ["gpt-5.4", 2.5, 0.25, 15],
    ["gpt-5.4-mini", 0.75, 0.075, 4.5],
    ["gpt-5.4-nano", 0.2, 0.02, 1.25],
    ["gpt-5.4-pro", 30, null, 180],
    ["gpt-5.2", 1.75, 0.175, 14],
    ["gpt-5.2-pro", 21, null, 168],
    ["gpt-5.1", 1.25, 0.125, 10],
    ["gpt-5", 1.25, 0.125, 10],
    ["gpt-5-mini", 0.25, 0.025, 2],
    ["gpt-5-nano", 0.05, 0.005, 0.4],
    ["gpt-5-pro", 15, null, 120],
    ["gpt-4.1", 2, 0.5, 8],
    ["gpt-4.1-mini", 0.4, 0.1, 1.6],
    ["gpt-4.1-nano", 0.1, 0.025, 0.4],
    ["gpt-4o", 2.5, 1.25, 10],
    ["gpt-4o-2024-05-13", 5, null, 15],
    ["gpt-4o-mini", 0.15, 0.075, 0.6],
    ["o1", 15, 7.5, 60],
    ["o1-pro", 150, null, 600],
    ["o3", 2, 0.5, 8],
    ["o3-pro", 20, null, 80],
    ["o3-mini", 1.1, 0.55, 4.4],
    ["o4-mini", 1.1, 0.275, 4.4],
  ]),
  272_000,
  {
    "gpt-6-astra": r(20, 2, 75),
    "gpt-6.1-sol": r(4, 0.2, 15),
    "gpt-6-sol": r(4, 0.4, 15),
    "gpt-6-luna": r(0.2, 0.02, 0.75),
    "gpt-5.6-sol": r(8, 0.8, 30),
    "gpt-5.6-terra": r(4, 0.4, 18),
    "gpt-5.6-luna": r(0.4, 0.04, 1.8),
    "gpt-5.5": r(10, 1, 45),
    "gpt-5.5-pro": r(60, null, 270),
    "gpt-5.4": r(5, 0.5, 22.5),
    "gpt-5.4-pro": r(60, null, 270),
  },
);

// Anthropic: cacheWrite is the 5-minute cache write price.
const anthropic: ModelPrice[] = (
  [
    ["claude-fable-5-1", 10, 0.25, 50, 12.5],
    ["claude-fable-5", 10, 1, 50, 12.5],
    ["claude-opus-5-5", 4, 0.2, 20, 5],
    ["claude-opus-5", 5, 0.5, 25, 6.25],
    ["claude-opus-4-8", 5, 0.5, 25, 6.25],
    ["claude-opus-4-7", 5, 0.5, 25, 6.25],
    ["claude-opus-4-6", 5, 0.5, 25, 6.25],
    ["claude-opus-4-5", 5, 0.5, 25, 6.25],
    ["claude-sonnet-5-5", 2, 0.1, 10, 2.5],
    ["claude-sonnet-5", 2, 0.2, 10, 2.5],
    ["claude-sonnet-4-6", 3, 0.3, 15, 3.75],
    ["claude-sonnet-4-5", 3, 0.3, 15, 3.75],
    ["claude-haiku-5-5", 0.1, 0.01, 0.5, 0.125],
    ["claude-haiku-4-5", 1, 0.1, 5, 1.25],
  ] as const
).map(([model, input, cached, output, cacheWrite]) => ({
  provider: "anthropic",
  model,
  effectiveFrom: LISTED,
  input,
  cached,
  output,
  cacheWrite,
  // Haiku 5.5 is the only current Claude model priced by prompt length.
  ...(model === "claude-haiku-5-5"
    ? { long: { threshold: 100_000, ...r(0.5, 0.05, 2.5, 0.625) } }
    : {}),
}));

// Google: prompts over 200K tokens use the long rates. Some prices rise on
// announced dates, listed as second rows.
const google = [
  ...withLong(
    rows("google", [
      ["gemini-4-argon", 2, 0.1, 10],
      ["gemini-3.8-flash", 0.75, 0.075, 3.75],
      ["gemini-3.6-flash", 0.75, 0.075, 3.75],
      ["gemini-3.5-flash-lite", 0.3, 0.03, 2.5],
      ["gemini-3.1-flash-lite", 0.25, 0.025, 1.5],
      ["gemini-3.1-pro-preview", 2, 0.2, 12],
      ["gemini-3-flash-preview", 0.5, 0.05, 3],
      ["gemini-2.5-pro", 1.25, 0.125, 10],
      ["gemini-2.5-flash", 0.3, 0.03, 2.5],
      ["gemini-2.5-flash-lite", 0.1, 0.01, 0.4],
    ]),
    200_000,
    {
      "gemini-3.1-pro-preview": r(4, 0.4, 18),
      "gemini-2.5-pro": r(2.5, 0.25, 15),
    },
  ),
  ...rows("google", [["gemini-4-argon", 4, 0.2, 20]], { effectiveFrom: "2026-12-01" }),
  ...rows(
    "google",
    [
      ["gemini-3.8-flash", 1.5, 0.15, 7.5],
      ["gemini-3.6-flash", 1.5, 0.15, 7.5],
    ],
    { effectiveFrom: "2027-01-01" },
  ),
];

// ---- Image, audio and video ----
// Token-priced media models use their media rates: image output for image
// models, audio for speech models. Text tokens in the same call are counted
// at those rates too, a slight overestimate for prompts.
// Unit-priced models have no token price (0) and a price per unit; pass
// `units` and `unit` (and a `variant` such as "1080p") when tracking.

const media = (
  provider: string,
  model: string,
  input: number,
  output: number,
  units?: Record<string, number>,
  effectiveFrom = LISTED,
): ModelPrice => ({ provider, model, effectiveFrom, input, output, ...(units ? { units } : {}) });

const openaiMedia: ModelPrice[] = [
  // Images: text prompt in, image tokens out.
  media("openai", "gpt-image-2.5-sunburst", 5, 30),
  media("openai", "gpt-image-2.5-flare", 5, 30),
  media("openai", "gpt-image-2", 5, 30),
  media("openai", "gpt-image-1.5", 5, 32),
  media("openai", "gpt-image-1-mini", 2, 8),
  media("openai", "gpt-image-1", 5, 40),
  media("openai", "chatgpt-image-latest", 5, 32),
  // Speech out: text in, audio tokens out.
  media("openai", "gpt-4o-mini-tts", 0.6, 12),
  media("openai", "tts-1", 0, 0, { character: 15 / 1e6 }),
  media("openai", "tts-1-hd", 0, 0, { character: 30 / 1e6 }),
  // Speech in.
  media("openai", "whisper-1", 0, 0, { minute: 0.006 }),
  media("openai", "gpt-transcribe", 0, 0, { minute: 0.0045 }),
  media("openai", "gpt-4o-transcribe", 2.5, 10, { minute: 0.006 }),
  media("openai", "gpt-4o-transcribe-diarize", 2.5, 10, { minute: 0.006 }),
  media("openai", "gpt-4o-mini-transcribe", 1.25, 5, { minute: 0.003 }),
  media("openai", "gpt-live-transcribe", 0, 0, { minute: 0.017 }),
  media("openai", "gpt-realtime-whisper", 0, 0, { minute: 0.017 }),
  media("openai", "gpt-realtime-translate", 0, 0, { minute: 0.034 }),
  // Realtime voice: audio tokens both ways.
  ...["gpt-realtime-2.1", "gpt-realtime-2", "gpt-realtime-1.5", "gpt-realtime", "gpt-audio-1.5", "gpt-audio"].map((m) => media("openai", m, 32, 64)),
  ...["gpt-realtime-2.1-mini", "gpt-realtime-mini", "gpt-audio-mini"].map((m) => media("openai", m, 10, 20)),
  media("openai", "gpt-live-1", 0, 0, { minute: 0.05 }),
];

// Gemini image models: per image by output size ("1k" by default), or by
// image output tokens when tracked from the response. Prompt tokens are not
// listed separately, so they count as zero.
const googleMedia: ModelPrice[] = [
  media("google", "gemini-3.1-flash-image", 0, 60, { image: 0.067, "image:0.5k": 0.045, "image:1k": 0.067, "image:2k": 0.101, "image:4k": 0.151 }),
  media("google", "gemini-3.1-flash-lite-image", 0, 30, { image: 0.0336, "image:1k": 0.0336 }),
  media("google", "gemini-nano-banana-2.1", 0, 30, { image: 0.0336, "image:1k": 0.0336, "image:2k": 0.0504, "image:4k": 0.113 }),
  media("google", "gemini-3-pro-image", 0, 120, { image: 0.134, "image:1k": 0.134, "image:2k": 0.134, "image:4k": 0.24 }),
  media("google", "gemini-2.5-flash-image", 0, 30, { image: 0.039 }),
  // Video per second, by resolution ("720p" by default).
  media("google", "veo-3.1-generate-preview", 0, 0, { second: 0.4, "second:720p": 0.4, "second:1080p": 0.4, "second:4k": 0.6 }),
  media("google", "veo-3.1-fast-generate-preview", 0, 0, { second: 0.1, "second:720p": 0.1, "second:1080p": 0.12, "second:4k": 0.3 }),
  media("google", "veo-3.1-lite-generate-preview", 0, 0, { second: 0.05, "second:720p": 0.05, "second:1080p": 0.08 }),
  // Speech out: text in, audio tokens out (25 tokens per second).
  media("google", "gemini-3.8-flash-tts", 0.5, 9),
  media("google", "gemini-3.8-flash-tts", 1, 18, undefined, "2027-01-01"),
  media("google", "gemini-3.8-flash-lite-tts", 0.5, 6),
  media("google", "gemini-3.8-flash-lite-tts", 1, 12, undefined, "2027-01-01"),
  media("google", "gemini-3.1-flash-tts-preview", 1, 20),
  media("google", "gemini-2.5-flash-preview-tts", 0.5, 10),
  media("google", "gemini-2.5-pro-preview-tts", 1, 20),
  // Live voice: audio tokens both ways.
  ...["gemini-3.8-live", "gemini-3.8-live-extended-thinking", "gemini-3.1-flash-live-preview"].map((m) => media("google", m, 3, 12)),
  media("google", "gemini-2.5-flash-native-audio-preview-12-2025", 3, 12),
];

export const MODEL_PRICES: readonly ModelPrice[] = [...openai, ...anthropic, ...google, ...openaiMedia, ...googleMedia];
