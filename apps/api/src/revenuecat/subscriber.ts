// Subscriber state is recomputed from all of a user's stored events on every
// new event, so late, out-of-order and duplicate deliveries need no special
// handling.

export interface RcEvent {
  type: string;
  eventTs: Date;
  productId: string | null;
  periodType: string | null;
  purchasedAt: Date | null;
  expirationAt: Date | null;
  priceUsd: number | null;
  netUsd: number | null;
  isTrialConversion: boolean | null;
}

export interface SubscriberState {
  state: "trial" | "paid" | "cancelled" | "expired";
  productId: string | null;
  trialStartedAt: Date | null;
  convertedAt: Date | null;
  expiresAt: Date | null;
  netRevenueUsd: number;
}

/** price × (1 − tax − commission); RevenueCat sends fractions, e.g. 0.3. */
export function netRevenue(price: number | null, tax: number | null, commission: number | null) {
  if (price === null) return null;
  return price * (1 - (tax ?? 0) - (commission ?? 0));
}

// Events that carry money: purchases and renewals add, a CANCELLATION with
// a negative price is a refund, REFUND_REVERSED adds it back.
const REVENUE_TYPES = new Set(["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE", "REFUND_REVERSED"]);

const ACTIVATING = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
  "REFUND_REVERSED",
]);

const STATEFUL = new Set([...ACTIVATING, "NON_RENEWING_PURCHASE", "CANCELLATION", "EXPIRATION"]);

function isRefund(e: RcEvent) {
  return e.type === "CANCELLATION" && e.priceUsd !== null && e.priceUsd < 0;
}

export function computeSubscriber(events: readonly RcEvent[], now: Date): SubscriberState | null {
  const sorted = [...events].sort(
    (a, b) =>
      a.eventTs.getTime() - b.eventTs.getTime() ||
      (a.purchasedAt?.getTime() ?? 0) - (b.purchasedAt?.getTime() ?? 0),
  );

  let s: SubscriberState | null = null;
  let micros = 0;

  for (const e of sorted) {
    if ((REVENUE_TYPES.has(e.type) || isRefund(e)) && e.netUsd !== null) {
      micros += Math.round(e.netUsd * 1e6);
    }

    if (!STATEFUL.has(e.type)) continue;
    s ??= {
      state: "expired",
      productId: null,
      trialStartedAt: null,
      convertedAt: null,
      expiresAt: null,
      netRevenueUsd: 0,
    };

    if (e.type === "INITIAL_PURCHASE" && e.periodType === "TRIAL") {
      const started = e.purchasedAt ?? e.eventTs;
      if (!s.trialStartedAt || started < s.trialStartedAt) s.trialStartedAt = started;
    }
    if (e.type === "RENEWAL" && e.isTrialConversion && !s.convertedAt) {
      s.convertedAt = e.purchasedAt ?? e.eventTs;
    }

    if (ACTIVATING.has(e.type)) {
      s.state = e.periodType === "TRIAL" ? "trial" : "paid";
      s.productId = e.productId ?? s.productId;
      if (e.expirationAt) s.expiresAt = e.expirationAt;
    } else if (e.type === "NON_RENEWING_PURCHASE") {
      if (s.state === "expired") {
        s.state = "paid";
        s.productId = e.productId ?? s.productId;
        // Null for lifetime purchases.
        s.expiresAt = e.expirationAt;
      }
    } else if (e.type === "CANCELLATION") {
      // A refund ends access; a plain cancellation only turns off renewal.
      s.state = isRefund(e) ? "expired" : s.state === "expired" ? "expired" : "cancelled";
    } else if (e.type === "EXPIRATION") {
      s.state = "expired";
      if (e.expirationAt) s.expiresAt = e.expirationAt;
    }
  }

  if (!s) return null;
  // The EXPIRATION webhook can lag behind the actual expiry.
  if (s.state !== "expired" && s.expiresAt && s.expiresAt < now) s.state = "expired";
  s.netRevenueUsd = micros / 1e6;
  return s;
}
