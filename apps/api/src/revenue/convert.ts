import type { schema } from "@fiscallm/shared";
import { z } from "zod";

// Revenue from any billing system, for apps without RevenueCat. Events
// become the same rows RevenueCat webhooks produce, so subscriber state,
// metrics, alerts and the weekly email treat both alike.

export const REVENUE_TYPES = ["trial_started", "purchase", "renewal", "refund", "cancellation", "expiration"] as const;

const DAY_MS = 86_400_000;
const fraction = z.number().min(0).max(1);

export const revenueEventSchema = z
  .object({
    // Your own unique id (e.g. the payment or invoice id); retries reuse it.
    id: z.string().min(1).max(200),
    userId: z.string().min(1).max(256),
    type: z.enum(REVENUE_TYPES),
    ts: z.iso
      .datetime({ offset: true })
      .transform((s) => new Date(s))
      .refine((d) => d.getTime() <= Date.now() + 3_600_000, "ts is in the future")
      .refine((d) => d.getTime() >= Date.now() - 3 * 365 * DAY_MS, "ts is more than 3 years old"),
    productId: z.string().min(1).max(200).optional(),
    // Gross amount the user paid, in USD. Refunds: the amount refunded, positive.
    amountUsd: z.number().min(0).max(100_000).optional(),
    // What you keep after tax and store or payment fees; or give the shares.
    netUsd: z.number().min(0).max(100_000).optional(),
    taxPct: fraction.optional(),
    feePct: fraction.optional(),
    // When the paid or trial period ends; omit for one-time purchases.
    periodEnd: z.iso.datetime({ offset: true }).transform((s) => new Date(s)).optional(),
    // A renewal that ends a free trial.
    isTrialConversion: z.boolean().optional(),
    // True for one-time purchases (lifetime, credits).
    oneTime: z.boolean().optional(),
    environment: z.enum(["production", "sandbox"]).optional(),
  })
  .refine((e) => !["purchase", "renewal", "refund"].includes(e.type) || e.amountUsd !== undefined, {
    message: "amountUsd is required for purchase, renewal and refund",
    path: ["amountUsd"],
  });

export const revenueBatchSchema = z.object({ events: z.array(revenueEventSchema).min(1).max(100) });
export type RevenueEvent = z.output<typeof revenueEventSchema>;
type RcEventRow = typeof schema.rcEvents.$inferInsert;

const dec = (n: number | undefined) => (n === undefined ? null : String(Math.round(n * 1e8) / 1e8));

/** Where a revenue event came from; sets the row id prefix, the store and extra raw fields. */
export interface RowSource {
  store: string;
  idPrefix: string;
  rawSource: string;
  extra?: Record<string, unknown>;
}

const API_SOURCE: RowSource = { store: "API", idPrefix: "api", rawSource: "revenue-api" };

export function toRcEvent(appId: string, e: RevenueEvent, src: RowSource = API_SOURCE): RcEventRow {
  const gross = e.amountUsd ?? 0;
  const tax = e.taxPct ?? 0;
  const fee = e.feePct ?? 0;
  const net = e.netUsd ?? gross * (1 - tax - fee);
  const sign = e.type === "refund" ? -1 : 1;
  const money = ["purchase", "renewal", "refund"].includes(e.type);

  const type = {
    trial_started: "INITIAL_PURCHASE",
    purchase: e.oneTime ? "NON_RENEWING_PURCHASE" : "INITIAL_PURCHASE",
    renewal: "RENEWAL",
    refund: "CANCELLATION",
    cancellation: "CANCELLATION",
    expiration: "EXPIRATION",
  }[e.type];

  return {
    appId,
    id: `${src.idPrefix}:${e.id}`,
    type,
    appUserId: e.userId,
    originalAppUserId: e.userId,
    productId: e.productId ?? null,
    periodType: e.type === "trial_started" ? "TRIAL" : "NORMAL",
    store: src.store,
    environment: e.environment === "sandbox" ? "SANDBOX" : "PRODUCTION",
    priceUsd: money ? dec(sign * gross) : e.type === "trial_started" || e.type === "cancellation" ? "0" : null,
    taxPct: money ? dec(tax) : null,
    commissionPct: money ? dec(fee) : null,
    netUsd: money ? dec(sign * net) : e.type === "trial_started" || e.type === "cancellation" ? "0" : null,
    isTrialConversion: e.type === "renewal" ? (e.isTrialConversion ?? false) : null,
    purchasedAt: e.type === "expiration" || e.type === "cancellation" ? null : e.ts,
    expirationAt: e.type === "expiration" ? e.ts : (e.periodEnd ?? null),
    eventTs: e.ts,
    raw: { source: src.rawSource, ...e, ...src.extra },
  };
}
