import { PGlite } from "@electric-sql/pglite";
import { generateIngestKey, hashKey, schema, sealSecret } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Hono } from "hono";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "../ingest/db";
import { mapStripeEvent, type MapContext } from "./map";
import { stripeRoute } from "./route";
import { sign, verifyStripeSignature } from "./verify";

const SECRET = "whsec_test_secret_123";
const NOW = Date.now();
const sec = (ms: number) => Math.floor(ms / 1000);
const DAY = 86_400_000;

describe("verifyStripeSignature", () => {
  const body = '{"id":"evt_1"}';
  const header = async (t = sec(NOW), secret = SECRET, payload = body) => `t=${t},v1=${await sign(payload, t, secret)}`;

  it("accepts a correct, recent signature", async () => {
    expect(await verifyStripeSignature(body, await header(), SECRET, NOW)).toBe(true);
  });

  it("accepts when one of several v1 signatures matches (secret rotation)", async () => {
    const t = sec(NOW);
    const h = `t=${t},v1=${"0".repeat(64)},v1=${await sign(body, t, SECRET)}`;
    expect(await verifyStripeSignature(body, h, SECRET, NOW)).toBe(true);
  });

  it("rejects a tampered body, a wrong secret, a missing or malformed header", async () => {
    expect(await verifyStripeSignature(body + " ", await header(), SECRET, NOW)).toBe(false);
    expect(await verifyStripeSignature(body, await header(sec(NOW), "whsec_other"), SECRET, NOW)).toBe(false);
    expect(await verifyStripeSignature(body, undefined, SECRET, NOW)).toBe(false);
    expect(await verifyStripeSignature(body, "garbage", SECRET, NOW)).toBe(false);
    expect(await verifyStripeSignature(body, `t=${sec(NOW)}`, SECRET, NOW)).toBe(false);
    expect(await verifyStripeSignature(body, await header(), "", NOW)).toBe(false);
  });

  it("rejects an old signature (replay) but allows a little clock drift", async () => {
    expect(await verifyStripeSignature(body, await header(sec(NOW) - 600), SECRET, NOW)).toBe(false);
    expect(await verifyStripeSignature(body, await header(sec(NOW) - 120), SECRET, NOW)).toBe(true);
  });
});

// Payloads shaped like Stripe's events, trimmed to the fields the mapper reads.
const invoicePaid = (over: Record<string, unknown> = {}, obj: Record<string, unknown> = {}) => ({
  id: "evt_inv_1",
  type: "invoice.paid",
  created: sec(NOW - DAY),
  livemode: true,
  data: {
    object: {
      id: "in_1",
      customer: "cus_A",
      currency: "usd",
      amount_paid: 1000,
      tax: 0,
      billing_reason: "subscription_create",
      subscription: "sub_1",
      subscription_details: { metadata: { user_id: "user-1" } },
      status_transitions: { paid_at: sec(NOW - DAY) },
      charge: "ch_1",
      lines: { data: [{ price: { id: "price_pro" }, period: { start: sec(NOW - DAY), end: sec(NOW + 29 * DAY) } }] },
      ...obj,
    },
  },
  ...over,
});

const none: MapContext = { knownUser: async () => null, refundedSoFar: async () => 0 };

describe("mapStripeEvent", () => {
  it("maps a first subscription invoice to a purchase for the user in metadata", async () => {
    const m = await mapStripeEvent(invoicePaid(), none);
    expect(m.ignored).toBeUndefined();
    const e = m.events[0]!;
    expect(e).toMatchObject({ id: "evt_inv_1", userId: "user-1", type: "purchase", productId: "price_pro", amountUsd: 10 });
    expect(e.periodEnd).toBeInstanceOf(Date);
    expect(e.oneTime).toBeUndefined();
    // 2.9% + $0.30 on $10 is $0.59, so 5.9% of the gross.
    expect(e.feePct).toBeCloseTo(0.059, 5);
    expect(m.extra).toMatchObject({ stripeCustomer: "cus_A", stripeInvoice: "in_1", stripeCharge: "ch_1" });
  });

  it("maps a recurring invoice to a renewal and takes tax out of what you keep", async () => {
    const m = await mapStripeEvent(invoicePaid({}, { billing_reason: "subscription_cycle", amount_paid: 1200, tax: 200 }), none);
    expect(m.events[0]).toMatchObject({ type: "renewal" });
    expect(m.events[0]!.taxPct).toBeCloseTo(200 / 1200, 5);
  });

  it("treats an invoice without a subscription as a one-time purchase", async () => {
    const m = await mapStripeEvent(invoicePaid({}, { billing_reason: "manual", subscription: null, subscription_details: null }), { ...none, knownUser: async () => "user-9" });
    expect(m.events[0]).toMatchObject({ type: "purchase", oneTime: true, userId: "user-9" });
  });

  it("finds the user in the newer parent.subscription_details layout", async () => {
    const m = await mapStripeEvent(
      invoicePaid({}, { subscription_details: undefined, subscription: undefined, parent: { subscription_details: { subscription: "sub_2", metadata: { fiscallm_user_id: "user-2" } } } }),
      none,
    );
    expect(m.events[0]).toMatchObject({ userId: "user-2" });
  });

  it("falls back to a user already seen for the customer, then to the customer id", async () => {
    const noMeta = { subscription_details: { metadata: {} } };
    const known = await mapStripeEvent(invoicePaid({}, noMeta), { ...none, knownUser: async (c) => (c === "cus_A" ? "user-7" : null) });
    expect(known.events[0]!.userId).toBe("user-7");
    const fallback = await mapStripeEvent(invoicePaid({}, noMeta), none);
    expect(fallback.events[0]!.userId).toBe("cus_A");
  });

  it("ignores zero-amount invoices, other currencies and unrelated events, saying why", async () => {
    expect((await mapStripeEvent(invoicePaid({}, { amount_paid: 0 }), none)).ignored).toMatch(/zero/);
    expect((await mapStripeEvent(invoicePaid({}, { currency: "eur" }), none)).ignored).toMatch(/USD/);
    expect((await mapStripeEvent({ id: "evt_x", type: "customer.created", data: { object: {} } }, none)).ignored).toMatch(/not used/);
    expect((await mapStripeEvent({}, none)).ignored).toMatch(/not a Stripe event/);
  });

  it("marks test-mode events as sandbox", async () => {
    const m = await mapStripeEvent(invoicePaid({ livemode: false }), none);
    expect(m.events[0]!.environment).toBe("sandbox");
  });

  it("maps trial start, auto-renew off and the end of a subscription", async () => {
    const sub = { id: "sub_1", customer: "cus_A", metadata: { user_id: "user-1" }, items: { data: [{ price: { id: "price_pro" } }] } };
    const trial = await mapStripeEvent({ id: "evt_s1", type: "customer.subscription.created", created: sec(NOW), data: { object: { ...sub, status: "trialing", trial_end: sec(NOW + 7 * DAY) } } }, none);
    expect(trial.events[0]).toMatchObject({ type: "trial_started", userId: "user-1", productId: "price_pro" });
    expect((await mapStripeEvent({ id: "evt_s0", type: "customer.subscription.created", data: { object: { ...sub, status: "active" } } }, none)).ignored).toBeDefined();

    const off = await mapStripeEvent({ id: "evt_s2", type: "customer.subscription.updated", created: sec(NOW), data: { object: { ...sub, cancel_at_period_end: true }, previous_attributes: { cancel_at_period_end: false } } }, none);
    expect(off.events[0]).toMatchObject({ type: "cancellation" });
    const other = await mapStripeEvent({ id: "evt_s3", type: "customer.subscription.updated", data: { object: { ...sub, cancel_at_period_end: true }, previous_attributes: { status: "trialing" } } }, none);
    expect(other.ignored).toBeDefined();

    const ended = await mapStripeEvent({ id: "evt_s4", type: "customer.subscription.deleted", created: sec(NOW), data: { object: sub } }, none);
    expect(ended.events[0]).toMatchObject({ type: "expiration" });
  });

  it("records only the new part of a refund", async () => {
    const charge = (cents: number) => ({ id: `evt_r${cents}`, type: "charge.refunded", created: sec(NOW), data: { object: { id: "ch_1", customer: "cus_A", currency: "usd", amount_refunded: cents, metadata: { user_id: "user-1" } } } });
    const first = await mapStripeEvent(charge(400), { ...none, refundedSoFar: async () => 0 });
    expect(first.events[0]).toMatchObject({ type: "refund", userId: "user-1", amountUsd: 4 });
    const second = await mapStripeEvent(charge(1000), { ...none, refundedSoFar: async () => 4 });
    expect(second.events[0]!.amountUsd).toBe(6);
    expect((await mapStripeEvent(charge(1000), { ...none, refundedSoFar: async () => 10 })).ignored).toMatch(/already/);
  });
});

describe("POST /webhooks/stripe/:appId", () => {
  let db: AnyDb;
  let appId: string;
  const prev = process.env.CRON_SECRET;

  beforeAll(async () => {
    process.env.CRON_SECRET = "server-secret";
    const pg = drizzle(new PGlite(), { schema });
    await migrate(pg, { migrationsFolder: fileURLToPath(new URL("../../../../packages/shared/drizzle", import.meta.url)) });
    db = pg as unknown as AnyDb;
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  beforeEach(async () => {
    await db.delete(schema.apps);
    const [app] = await db
      .insert(schema.apps)
      .values({ name: "t", ownerId: crypto.randomUUID(), ingestKeyHash: await hashKey(generateIngestKey()), rcWebhookSecret: "x", stripeWebhookSecretCipher: await sealSecret("server-secret", SECRET) })
      .returning();
    appId = app!.id;
  });

  const post = async (event: unknown, opts: { secret?: string; id?: string } = {}) => {
    const body = JSON.stringify(event);
    const t = sec(Date.now());
    return new Hono().route("/webhooks/stripe", stripeRoute(() => db)).request(`/webhooks/stripe/${opts.id ?? appId}`, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": `t=${t},v1=${await sign(body, t, opts.secret ?? SECRET)}` },
      body,
    });
  };
  const subscriber = async (u: string) => (await db.select().from(schema.subscribers).where(eq(schema.subscribers.userId, u)))[0];

  it("refuses an unsigned or wrongly signed request and an app without Stripe", async () => {
    expect((await post(invoicePaid(), { secret: "whsec_wrong" })).status).toBe(400);
    const unsigned = await new Hono().route("/webhooks/stripe", stripeRoute(() => db)).request(`/webhooks/stripe/${appId}`, { method: "POST", body: "{}" });
    expect(unsigned.status).toBe(400);
    expect((await post(invoicePaid(), { id: crypto.randomUUID() })).status).toBe(404);
    await db.update(schema.apps).set({ stripeWebhookSecretCipher: null });
    expect((await post(invoicePaid())).status).toBe(404);
  });

  it("turns a paid invoice into revenue, once, even if Stripe retries", async () => {
    const res = await post(invoicePaid());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, accepted: 1, duplicates: 0 });
    expect(await (await post(invoicePaid())).json()).toMatchObject({ accepted: 0, duplicates: 1 });

    const rows = await db.select().from(schema.rcEvents).where(eq(schema.rcEvents.appId, appId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "stripe:evt_inv_1", store: "STRIPE", appUserId: "user-1" });
    // $10 less tax (0) less the estimated fee ($0.59).
    expect(Number(rows[0]!.netUsd)).toBeCloseTo(9.41, 2);
    expect((await subscriber("user-1"))?.state).toBe("paid");
  });

  it("follows a trial into a paid conversion, and a refund reduces revenue", async () => {
    const sub = { id: "sub_1", customer: "cus_A", metadata: { user_id: "user-1" }, items: { data: [{ price: { id: "price_pro" } }] } };
    await post({ id: "evt_t", type: "customer.subscription.created", created: sec(Date.now() - 8 * DAY), data: { object: { ...sub, status: "trialing", trial_end: sec(Date.now() + 3_600_000) } } });
    expect((await subscriber("user-1"))?.state).toBe("trial");

    await post(invoicePaid({ id: "evt_conv" }, { billing_reason: "subscription_cycle" }));
    const afterPay = await subscriber("user-1");
    expect(afterPay?.state).toBe("paid");
    expect(afterPay?.convertedAt).not.toBeNull();
    const paid = Number(afterPay?.netRevenueUsd);
    expect(paid).toBeGreaterThan(9);

    await post({ id: "evt_ref", type: "charge.refunded", created: sec(Date.now()), data: { object: { id: "ch_1", customer: "cus_A", currency: "usd", amount_refunded: 1000, metadata: { user_id: "user-1" } } } });
    expect(Number((await subscriber("user-1"))?.netRevenueUsd)).toBeLessThan(paid - 9.9);
  });

  it("acknowledges events it does not use, so Stripe does not keep retrying", async () => {
    const res = await post({ id: "evt_c", type: "customer.created", data: { object: {} } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true });
  });
});
