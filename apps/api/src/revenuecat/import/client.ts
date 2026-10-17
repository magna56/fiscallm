// RevenueCat REST API v2, read-only, for importing history.
// https://www.revenuecat.com/docs/api-v2

export interface Money {
  currency: string;
  gross: number;
  commission?: number;
  tax: number;
  proceeds: number;
}

export interface RcSubscription {
  id: string;
  customer_id: string;
  product_id: string | null;
  starts_at: number;
  current_period_starts_at: number;
  current_period_ends_at: number | null;
  ends_at: number | null;
  gives_access: boolean;
  auto_renewal_status: string;
  status: string;
  environment: string;
  store: string;
  total_revenue_in_usd?: Money | null;
}

/** Stores RevenueCat returns per-transaction history for. */
export const TRANSACTION_STORES = new Set(["app_store", "play_store"]);

export interface RcTransaction {
  id: string;
  purchased_at: number;
  product_store_identifier: string;
  revenue_in_usd: Money | null;
  expiration_date: number | null;
}

export interface RcPurchase {
  id: string;
  product_id: string;
  purchased_at: number;
  revenue_in_usd: Money;
  store: string;
  environment: string;
  status: "owned" | "refunded" | string;
}

/** What the importer needs; a fake implements it in tests. */
export interface RcApi {
  /** One page of customers after `cursor`, and whether there are more. */
  customers(cursor: string | null): Promise<{ ids: string[]; more: boolean }>;
  aliases(customerId: string): Promise<string[]>;
  subscriptions(customerId: string): Promise<RcSubscription[]>;
  transactions(subscriptionId: string): Promise<RcTransaction[]>;
  purchases(customerId: string): Promise<RcPurchase[]>;
}

export class RcApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const BASE = "https://api.revenuecat.com/v2";
// The customer endpoints allow 480 requests a minute per key.
const MIN_GAP_MS = 130;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function revenueCatApi(projectId: string, secretKey: string, opts: { sandbox: boolean; base?: string } = { sandbox: false }): RcApi {
  const base = `${opts.base ?? BASE}/projects/${encodeURIComponent(projectId)}`;
  const env = opts.sandbox ? "" : "environment=production&";
  let last = 0;

  async function get<T>(path: string): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const wait = last + MIN_GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      const res = await fetch(`${base}${path}`, {
        headers: { authorization: `Bearer ${secretKey}`, accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return (await res.json()) as T;
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        const body = (await res.json().catch(() => ({}))) as { backoff_ms?: number };
        const retryAfter = Number(res.headers.get("retry-after")) * 1000;
        await sleep(body.backoff_ms ?? (retryAfter || 1000 * 2 ** attempt));
        continue;
      }
      const text = await res.text().catch(() => "");
      throw new RcApiError(res.status, `RevenueCat ${res.status}: ${text.slice(0, 200)}`);
    }
  }

  // Follows next_page links; each list endpoint returns at most 100 a page.
  async function all<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    let page: { items: T[]; next_page?: string | null } = await get(path);
    items.push(...page.items);
    while (page.next_page) {
      const next = new URL(page.next_page, BASE);
      page = await get(`${next.pathname.replace(/^.*?\/projects\/[^/]+/, "")}${next.search}`);
      items.push(...page.items);
    }
    return items;
  }

  return {
    async customers(cursor) {
      const after = cursor ? `&starting_after=${encodeURIComponent(cursor)}` : "";
      const page = await get<{ items: { id: string }[]; next_page?: string | null }>(`/customers?limit=50${after}`);
      return { ids: page.items.map((c) => c.id), more: Boolean(page.next_page) };
    },
    async aliases(id) {
      return (await all<{ id: string }>(`/customers/${encodeURIComponent(id)}/aliases?limit=100`)).map((a) => a.id);
    },
    subscriptions: (id) => all<RcSubscription>(`/customers/${encodeURIComponent(id)}/subscriptions?${env}limit=100`),
    transactions: (id) => all<RcTransaction>(`/subscriptions/${encodeURIComponent(id)}/transactions?limit=100`),
    purchases: (id) => all<RcPurchase>(`/customers/${encodeURIComponent(id)}/purchases?${env}limit=100`),
  };
}
