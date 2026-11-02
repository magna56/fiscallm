import { describe, expect, it } from "vitest";
import { settle, type StripeRequest } from "./settlement";

/** A fake Stripe API answering fixed paths. */
const fake = (routes: Record<string, unknown>): StripeRequest => async (path) => {
  if (!(path in routes)) throw new Error(`unexpected ${path}`);
  return routes[path] as Record<string, unknown>;
};
const charge = { id: "ch_1", amount: 2000, balance_transaction: { amount: 2150, fee: 95, currency: "usd" } };

describe("settle", () => {
  it("reads the charge of an old-style invoice", async () => {
    const s = await settle(fake({ "/v1/charges/ch_1": charge }), { invoice: { id: "in_1", charge: "ch_1" } });
    expect(s).toEqual({ chargeId: "ch_1", grossUsd: 21.5, feeUsd: 0.95, usdPerUnit: 21.5 / 2000 });
  });

  it("finds the charge through invoice payments and the payment intent (newer API)", async () => {
    const req = fake({
      "/v1/invoice_payments": { data: [{ payment: { type: "payment_intent", payment_intent: "pi_1" } }] },
      "/v1/payment_intents/pi_1": { id: "pi_1", latest_charge: "ch_1" },
      "/v1/charges/ch_1": charge,
    });
    expect((await settle(req, { invoice: { id: "in_2" } }))?.chargeId).toBe("ch_1");
  });

  it("gives up (null) for non-USD settlement or API errors", async () => {
    const eur = { ...charge, balance_transaction: { amount: 2000, fee: 90, currency: "eur" } };
    expect(await settle(fake({ "/v1/charges/ch_1": eur }), { chargeId: "ch_1" })).toBeNull();
    expect(await settle(fake({}), { chargeId: "ch_1" })).toBeNull();
  });
});
