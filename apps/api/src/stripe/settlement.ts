// What Stripe actually settled for a payment: the exact fee and the amount in
// the account's payout currency, from the payment's balance transaction. Needs
// a read-only key; without one the mapper estimates the fee and takes USD only.

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const idOf = (v: unknown): string | undefined => str(v) ?? str(rec(v).id);
const first = (v: unknown): Rec => rec((rec(v).data as unknown[] | undefined)?.[0]);

/** GET a Stripe API path; resolves to the parsed JSON body. */
export type StripeRequest = (path: string, params?: Record<string, string>) => Promise<Rec>;

export class StripeApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function stripeRequest(key: string): StripeRequest {
  return async (path, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`https://api.stripe.com${path}${qs ? `?${qs}` : ""}`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await res.json().catch(() => ({}))) as Rec;
    if (!res.ok) throw new StripeApiError(res.status, String(rec(body.error).message ?? `Stripe answered ${res.status}`));
    return body;
  };
}

export interface Settlement {
  chargeId: string;
  /** Settled amount of the whole charge, USD. */
  grossUsd: number;
  feeUsd: number;
  /** USD per smallest unit of the charge's own currency (0.01 for a USD charge). */
  usdPerUnit: number;
}

/** The charge behind an invoice, in both the old (invoice.charge) and new (invoice payments) API shapes. */
async function chargeOfInvoice(req: StripeRequest, invoice: Rec): Promise<string | undefined> {
  const payment = rec(first(invoice.payments).payment);
  const direct = idOf(invoice.charge) ?? idOf(payment.charge);
  if (direct) return direct;
  let pi = idOf(invoice.payment_intent) ?? idOf(payment.payment_intent);
  if (!pi && str(invoice.id)) {
    const listed = rec(first(await req("/v1/invoice_payments", { invoice: str(invoice.id)!, limit: "1" })).payment);
    const charge = idOf(listed.charge);
    if (charge) return charge;
    pi = idOf(listed.payment_intent);
  }
  if (!pi) return undefined;
  return idOf((await req(`/v1/payment_intents/${pi}`)).latest_charge);
}

/** Settlement for an invoice or a charge; null when it cannot be read or settles in another currency than USD. */
export async function settle(req: StripeRequest, ref: { invoice?: Rec; chargeId?: string }): Promise<Settlement | null> {
  try {
    const chargeId = ref.chargeId ?? (ref.invoice ? await chargeOfInvoice(req, ref.invoice) : undefined);
    if (!chargeId) return null;
    const charge = await req(`/v1/charges/${chargeId}`, { "expand[]": "balance_transaction" });
    const bt = rec(charge.balance_transaction);
    const [amount, fee, chargeAmount] = [num(bt.amount), num(bt.fee), num(charge.amount)];
    if (str(bt.currency)?.toLowerCase() !== "usd" || amount === undefined || fee === undefined || !chargeAmount) return null;
    return { chargeId, grossUsd: amount / 100, feeUsd: fee / 100, usdPerUnit: amount / 100 / chargeAmount };
  } catch {
    return null;
  }
}

/** The customer of a charge, for events (disputes) that carry only the charge id. */
export async function customerOfCharge(req: StripeRequest, chargeId: string): Promise<{ customer?: string; metadata: Rec }> {
  try {
    const charge = await req(`/v1/charges/${chargeId}`);
    return { customer: idOf(charge.customer), metadata: rec(charge.metadata) };
  } catch {
    return { metadata: {} };
  }
}
