// Turns a customer's RevenueCat API history into rc_events rows shaped like
// webhook events, so subscriber state and metrics treat both the same way.

import type { schema } from "@fiscallm/shared";
import type { Money, RcPurchase, RcSubscription, RcTransaction } from "./client";

export type RcEventRow = typeof schema.rcEvents.$inferInsert;

export interface CustomerHistory {
  customerId: string;
  /** transactions is null for stores without per-transaction history. */
  subscriptions: { subscription: RcSubscription; transactions: RcTransaction[] | null }[];
  purchases: RcPurchase[];
}

const ENV: Record<string, string> = { production: "PRODUCTION", sandbox: "SANDBOX" };
const dec = (n: number | null | undefined) => (n == null ? null : String(n));
const date = (ms: number | null | undefined) => (ms == null ? null : new Date(ms));

/** Tax and commission as fractions of gross, as webhooks report them. */
function money(m: Money | null) {
  if (!m) return { priceUsd: null, taxPct: null, commissionPct: null, netUsd: null };
  const share = (part: number | undefined) => (m.gross > 0 && part != null ? Math.round((part / m.gross) * 10_000) / 10_000 : 0);
  return {
    priceUsd: dec(m.gross),
    taxPct: dec(share(m.tax)),
    commissionPct: dec(share(m.commission)),
    netUsd: dec(m.proceeds),
  };
}

/**
 * Only history from before `cutoff` is imported: from then on the app's
 * webhook delivers the same purchases, and importing them too would count
 * revenue twice.
 */
export function convertCustomer(
  appId: string,
  h: CustomerHistory,
  cutoff: Date,
  productNames: Map<string, string> | null = null,
): RcEventRow[] {
  const rows: RcEventRow[] = [];
  // Webhooks name products by store identifier; use the same names.
  const name = (id: string | null) => (id ? (productNames?.get(id) ?? id) : null);
  const base = (id: string, type: string, at: number, extra: Partial<RcEventRow>): RcEventRow => ({
    appId,
    id: `import:${id}`,
    type,
    appUserId: h.customerId,
    originalAppUserId: h.customerId,
    eventTs: new Date(at),
    raw: { source: "revenuecat-api-import" },
    ...extra,
  });

  for (const { subscription: s, transactions } of h.subscriptions) {
    const env = ENV[s.environment] ?? s.environment?.toUpperCase() ?? null;
    const store = s.store?.toUpperCase() ?? null;

    if (transactions === null) {
      // Stripe, Web Billing, Test Store and others: RevenueCat gives only the
      // subscription's totals, so its revenue is dated at the start.
      if (s.starts_at >= cutoff.getTime()) continue;
      const total = s.total_revenue_in_usd ?? null;
      const trial = s.status === "trialing" && (total?.gross ?? 0) === 0;
      rows.push(
        base(`${s.id}:summary`, "INITIAL_PURCHASE", s.starts_at, {
          productId: name(s.product_id),
          periodType: trial ? "TRIAL" : "NORMAL",
          store,
          environment: env,
          ...money(total),
          purchasedAt: date(s.starts_at),
          expirationAt: date(s.current_period_ends_at),
        }),
      );
      if (s.status === "expired" && s.ends_at != null && s.ends_at < cutoff.getTime()) {
        rows.push(base(`${s.id}:expired`, "EXPIRATION", s.ends_at, { productId: name(s.product_id), store, environment: env, expirationAt: date(s.ends_at) }));
      } else if (s.gives_access && s.auto_renewal_status === "will_not_renew") {
        rows.push(base(`${s.id}:cancelled`, "CANCELLATION", s.starts_at + 1, { productId: name(s.product_id), store, environment: env, priceUsd: "0", netUsd: "0" }));
      }
      continue;
    }

    const txs = [...transactions].sort((a, b) => a.purchased_at - b.purchased_at);
    // A free first period is a trial; the period after it is the conversion.
    const firstIsTrial = txs.length > 0 && (txs[0]!.revenue_in_usd?.gross ?? 0) === 0;

    txs.forEach((tx, i) => {
      if (tx.purchased_at >= cutoff.getTime()) return;
      const trial = i === 0 && firstIsTrial;
      rows.push(
        base(`${s.id}:${tx.id}`, i === 0 ? "INITIAL_PURCHASE" : "RENEWAL", tx.purchased_at, {
          productId: tx.product_store_identifier || name(s.product_id),
          periodType: trial ? "TRIAL" : "NORMAL",
          store,
          environment: env,
          ...money(tx.revenue_in_usd),
          isTrialConversion: i === 1 && firstIsTrial ? true : i === 0 ? null : false,
          purchasedAt: date(tx.purchased_at),
          expirationAt: date(tx.expiration_date),
        }),
      );
    });

    const lastAt = txs.at(-1)?.purchased_at ?? s.starts_at;
    if (lastAt >= cutoff.getTime()) continue;
    const productId = txs.at(-1)?.product_store_identifier || name(s.product_id);
    if (s.status === "expired" && s.ends_at != null && s.ends_at < cutoff.getTime()) {
      rows.push(base(`${s.id}:expired`, "EXPIRATION", s.ends_at, { productId, store, environment: env, expirationAt: date(s.ends_at) }));
    } else if (s.gives_access && s.auto_renewal_status === "will_not_renew") {
      // Renewal turned off but still active: a plain cancellation.
      rows.push(base(`${s.id}:cancelled`, "CANCELLATION", lastAt + 1, { productId, store, environment: env, priceUsd: "0", netUsd: "0" }));
    }
  }

  for (const p of h.purchases) {
    if (p.purchased_at >= cutoff.getTime()) continue;
    const env = ENV[p.environment] ?? p.environment?.toUpperCase() ?? null;
    const store = p.store?.toUpperCase() ?? null;
    rows.push(
      base(p.id, "NON_RENEWING_PURCHASE", p.purchased_at, {
        productId: name(p.product_id),
        periodType: "NORMAL",
        store,
        environment: env,
        ...money(p.revenue_in_usd),
        purchasedAt: date(p.purchased_at),
      }),
    );
    if (p.status === "refunded") {
      // The API gives no refund date; count it right after the purchase.
      const paid = money(p.revenue_in_usd);
      rows.push(
        base(`${p.id}:refund`, "CANCELLATION", p.purchased_at + 1, {
          productId: name(p.product_id),
          store,
          environment: env,
          priceUsd: dec(-p.revenue_in_usd.gross),
          taxPct: paid.taxPct,
          commissionPct: paid.commissionPct,
          netUsd: dec(-p.revenue_in_usd.proceeds),
          purchasedAt: date(p.purchased_at),
        }),
      );
    }
  }
  return rows;
}
