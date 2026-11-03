import { type RevenueEvent, revenueEventSchema } from "../revenue/convert";
import type { Settlement } from "./settlement";

// Turns a Stripe webhook event into the revenue events FiscaLLM already
// understands (the same ones the revenue API takes), so Stripe revenue flows
// through the same code as RevenueCat revenue.
//
// Handled: invoice.paid, customer.subscription.created (trialing),
// customer.subscription.updated (auto-renew switched off),
// customer.subscription.deleted, charge.refunded, charge.dispute.closed (lost).
// Everything else is ignored. Without a Stripe key: USD only, and Stripe's fee
// is estimated. With a read-only key (ctx.settle), the exact fee and the
// settled USD amount are read from Stripe, so any currency settled in USD works.

/** Which user an event belongs to: metadata first, then the Stripe customer. */
export const USER_METADATA_KEYS = ["fiscallm_user_id", "user_id", "userId"] as const;

// Stripe's standard US card price, used to estimate what you keep.
export const STRIPE_FEE_PCT = 0.029;
export const STRIPE_FEE_FIXED_USD = 0.3;

type Rec = Record<string, unknown>;

export interface StripeEvent {
  id?: unknown;
  type?: unknown;
  created?: unknown;
  livemode?: unknown;
  data?: unknown;
}

export interface MapContext {
  /** The user ID already seen for this Stripe customer, if any. */
  knownUser(customerId: string): Promise<string | null>;
  /** USD already recorded as refunded for this charge. */
  refundedSoFar(chargeId: string): Promise<number>;
  /** True if this invoice is already stored (by the webhook or the history import). */
  invoiceSeen?(invoiceId: string): Promise<boolean>;
  /** Exact fee and USD amount from Stripe; only when the app has a read-only key. */
  settle?(ref: { invoice?: Rec; chargeId?: string }): Promise<Settlement | null>;
  /** The user of an already stored payment for this charge. */
  userForCharge?(chargeId: string): Promise<string | null>;
  /** Reads a charge's customer from Stripe; only with a key. */
  customerOfCharge?(chargeId: string): Promise<{ customer?: string; metadata: Rec }>;
}

export interface Mapped {
  events: RevenueEvent[];
  /** Extra fields kept on the stored row, used to look events up later. */
  extra: Record<string, unknown>;
  /** Why nothing was stored, for the response. */
  ignored?: string;
}

const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const iso = (sec: unknown): string | undefined => (num(sec) === undefined ? undefined : new Date(num(sec)! * 1000).toISOString());
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round2 = (n: number) => Math.round(n * 100) / 100;
/** An id field that Stripe may send as a string or as an expanded object. */
const idOf = (v: unknown): string | undefined => str(v) ?? str(rec(v).id);

function userFromMetadata(...sources: unknown[]): string | undefined {
  for (const s of sources) {
    const m = rec(s);
    for (const k of USER_METADATA_KEYS) {
      const v = m[k];
      if (typeof v === "string" && v.trim()) return v.trim().slice(0, 256);
    }
  }
  return undefined;
}

async function resolveUser(ctx: MapContext, customer: string | undefined, ...metadata: unknown[]) {
  const fromMeta = userFromMetadata(...metadata);
  if (fromMeta) return fromMeta;
  if (!customer) return undefined;
  return (await ctx.knownUser(customer)) ?? customer;
}

const ignored = (reason: string): Mapped => ({ events: [], extra: {}, ignored: reason });

/** The subscription line of an invoice: the one whose period ends last (proration lines end earlier). */
function mainLine(invoice: Rec): Rec {
  const lines = list(rec(invoice.lines).data).map(rec);
  return lines.reduce<Rec>((best, l) => ((num(rec(l.period).end) ?? 0) > (num(rec(best.period).end) ?? -1) ? l : best), lines[0] ?? {});
}

function productOf(item: Rec): string {
  const priceDetails = rec(rec(item.pricing).price_details);
  return str(rec(item.price).id) ?? str(rec(item.plan).id) ?? str(priceDetails.price) ?? "stripe";
}

/** USD per smallest currency unit of a charge: 0.01 for USD, or read from Stripe. Null if unknown. */
async function usdPerUnitOf(ctx: MapContext, chargeId: string, currency: string | undefined): Promise<number | null> {
  const settled = await ctx.settle?.({ chargeId });
  if (settled) return settled.usdPerUnit;
  return currency?.toLowerCase() === "usd" ? 0.01 : null;
}

export async function mapStripeEvent(event: StripeEvent, ctx: MapContext): Promise<Mapped> {
  const id = str(event.id);
  const type = str(event.type);
  if (!id || !type) return ignored("not a Stripe event");
  const obj = rec(rec(event.data).object);
  const environment = event.livemode === false ? "sandbox" : "production";
  const eventTs = iso(event.created) ?? new Date().toISOString();

  const finish = (input: Record<string, unknown>, extra: Record<string, unknown>): Mapped => {
    // Same checks as the revenue API: no future dates, fractions between 0 and 1.
    const ok = revenueEventSchema.safeParse(input);
    return ok.success ? { events: [ok.data], extra } : ignored(`invalid: ${ok.error.issues[0]?.message ?? "bad event"}`);
  };

  switch (type) {
    case "invoice.paid": {
      const currency = str(obj.currency)?.toLowerCase();
      const paidCents = num(obj.amount_paid) ?? 0;
      if (paidCents <= 0) return ignored("zero amount");
      const invoiceId = str(obj.id);
      if (invoiceId && (await ctx.invoiceSeen?.(invoiceId))) return ignored("already counted");
      const customer = idOf(obj.customer);
      const parentSub = rec(rec(obj.parent).subscription_details);
      const line = mainLine(obj);
      const userId = await resolveUser(ctx, customer, rec(obj.subscription_details).metadata, parentSub.metadata, obj.metadata, line.metadata);
      if (!userId) return ignored("no user: set metadata.user_id on the subscription or customer");

      // Exact numbers from Stripe when a key is connected; otherwise USD with the standard fee.
      const settled = await ctx.settle?.({ invoice: obj });
      if (!settled && currency !== "usd") return ignored("only USD is supported without a read-only Stripe key");
      const gross = settled ? settled.grossUsd : paidCents / 100;
      const taxPct = clamp01((num(obj.tax) ?? 0) / paidCents);
      const feePct = clamp01(settled ? settled.feeUsd / gross : (gross * STRIPE_FEE_PCT + STRIPE_FEE_FIXED_USD) / gross);
      const reason = str(obj.billing_reason) ?? "";
      const isSubscription = Boolean(idOf(obj.subscription) || idOf(parentSub.subscription) || reason.startsWith("subscription"));
      const renewal = reason === "subscription_cycle" || reason === "subscription_update" || reason === "subscription_threshold";
      return finish(
        {
          id,
          userId,
          type: renewal ? "renewal" : "purchase",
          productId: productOf(line),
          amountUsd: round2(gross),
          taxPct,
          feePct,
          periodEnd: isSubscription ? iso(rec(line.period).end) : undefined,
          oneTime: isSubscription ? undefined : true,
          environment,
          // Test clocks date payments in the simulated future; never later than the event itself.
          ts: [iso(rec(obj.status_transitions).paid_at) ?? eventTs, eventTs].sort()[0],
        },
        {
          stripeCustomer: customer,
          stripeInvoice: invoiceId,
          stripeCharge: settled?.chargeId ?? idOf(obj.charge),
          stripeFee: settled ? "exact" : "estimated",
          ...(currency !== "usd" ? { stripeCurrency: currency } : {}),
        },
      );
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const customer = idOf(obj.customer);
      const userId = await resolveUser(ctx, customer, obj.metadata);
      if (!userId) return ignored("no user: set metadata.user_id on the subscription or customer");
      const productId = productOf(rec(list(rec(obj.items).data)[0]));
      const extra = { stripeCustomer: customer, stripeSubscription: str(obj.id) };
      const base = { id, userId, productId, environment, ts: eventTs } as const;

      if (type === "customer.subscription.created") {
        if (obj.status !== "trialing") return ignored("not a trial start");
        return finish({ ...base, type: "trial_started", periodEnd: iso(obj.trial_end) }, extra);
      }
      if (type === "customer.subscription.updated") {
        const switchedOff = obj.cancel_at_period_end === true && rec(rec(event.data).previous_attributes).cancel_at_period_end === false;
        return switchedOff ? finish({ ...base, type: "cancellation" }, extra) : ignored("no change that matters");
      }
      return finish({ ...base, type: "expiration" }, extra);
    }

    case "charge.refunded": {
      const chargeId = str(obj.id);
      const refundedUnits = num(obj.amount_refunded) ?? 0;
      if (!chargeId || refundedUnits <= 0) return ignored("nothing refunded");
      const usdPerUnit = await usdPerUnitOf(ctx, chargeId, str(obj.currency));
      if (usdPerUnit === null) return ignored("only USD is supported without a read-only Stripe key");
      const customer = idOf(obj.customer);
      const userId = (await ctx.userForCharge?.(chargeId)) ?? (await resolveUser(ctx, customer, obj.metadata));
      if (!userId) return ignored("no user: set metadata.user_id on the subscription or customer");
      // amount_refunded is the running total for the charge; record only the new part.
      const delta = round2(refundedUnits * usdPerUnit - (await ctx.refundedSoFar(chargeId)));
      if (delta <= 0) return ignored("already counted");
      // The refund returns the money the customer paid; the fee is not returned,
      // and the tax portion is not known here, so the whole amount comes off.
      return finish(
        { id, userId, type: "refund", amountUsd: delta, taxPct: 0, feePct: 0, environment, ts: eventTs },
        { stripeCustomer: customer, stripeCharge: chargeId, stripeRefundCents: refundedUnits },
      );
    }

    case "charge.dispute.closed": {
      // Only a lost dispute takes money away for good; won ones change nothing.
      if (obj.status !== "lost") return ignored("dispute not lost");
      const chargeId = idOf(obj.charge);
      const units = num(obj.amount) ?? 0;
      if (!chargeId || units <= 0) return ignored("nothing disputed");
      const usdPerUnit = await usdPerUnitOf(ctx, chargeId, str(obj.currency));
      if (usdPerUnit === null) return ignored("only USD is supported without a read-only Stripe key");
      let userId = await ctx.userForCharge?.(chargeId);
      if (!userId && ctx.customerOfCharge) {
        const c = await ctx.customerOfCharge(chargeId);
        userId = await resolveUser(ctx, c.customer, c.metadata);
      }
      if (!userId) return ignored("no user for the disputed payment");
      // Counted like a refund, against the same charge, so a refund after it is not counted twice.
      const delta = round2(units * usdPerUnit - (await ctx.refundedSoFar(chargeId)));
      if (delta <= 0) return ignored("already counted");
      return finish(
        { id, userId, type: "refund", amountUsd: delta, taxPct: 0, feePct: 0, environment, ts: eventTs },
        { stripeCharge: chargeId, stripeDispute: str(obj.id) },
      );
    }

    default:
      return ignored(`event type ${type} is not used`);
  }
}
