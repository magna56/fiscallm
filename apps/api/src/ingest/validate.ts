import { z } from "zod";

export const MAX_EVENTS = 100;
const DAY_MS = 86_400_000;

const tokens = z.number().int().nonnegative().max(1e9).default(0);

export const eventSchema = z.object({
  // Client-generated, so retries of the same event are deduplicated.
  id: z.uuid(),
  userId: z.string().min(1).max(256),
  ts: z.iso
    .datetime({ offset: true })
    .transform((s) => new Date(s))
    .refine((d) => d.getTime() <= Date.now() + 3_600_000, "ts is in the future")
    .refine((d) => d.getTime() >= Date.now() - 90 * DAY_MS, "ts is older than 90 days"),
  provider: z.string().min(1).max(64).toLowerCase(),
  model: z.string().min(1).max(128),
  // Excludes cache reads and cache writes.
  inputTokens: tokens,
  outputTokens: tokens,
  cachedTokens: tokens,
  cacheWriteTokens: tokens,
  // Non-token usage, priced per unit: images, seconds of video, minutes of
  // audio, characters of speech. `variant` picks e.g. a resolution.
  units: z.number().positive().max(1e9).optional(),
  unit: z.enum(["image", "second", "minute", "character"]).optional(),
  variant: z.string().min(1).max(32).optional(),
  // An exact cost; wins over the price table.
  costUsd: z.number().nonnegative().max(1000).optional(),
  feature: z.string().min(1).max(64).optional(),
});

const withUnit = eventSchema.refine((e) => (e.units === undefined) === (e.unit === undefined), {
  message: "units and unit go together",
});

export const batchSchema = z.object({
  events: z.array(withUnit).min(1).max(MAX_EVENTS),
});

export type IngestEvent = z.output<typeof eventSchema>;
