#!/usr/bin/env node
// End-to-end check of the Stripe connector against a real Stripe account in
// TEST mode. It uses Stripe test clocks to run months of billing in minutes:
//
//   user A: 7-day trial → converts → renews → partial $5 refund → cancels
//   user B: pays → disputes the charge → loses the dispute
//   user C: pays in EUR (needs the saved read-only key in FiscaLLM)
//
// Setup (once):
//   1. Create a FiscaLLM app for testing and open its Setup page.
//   2. STRIPE_TEST_KEY=sk_test_... FISCALLM_WEBHOOK_URL=<Stripe webhook URL from Setup> node scripts/stripe-e2e.mjs --webhook
//      creates the webhook endpoint in Stripe and prints its signing secret: paste it under "Connect Stripe".
//   3. Optional: save a read-only rk_test_ key under "Exact fees and other currencies".
// Run:
//   STRIPE_TEST_KEY=sk_test_... node scripts/stripe-e2e.mjs
// Then compare the app's Users page with the expected numbers printed at the end.

const KEY = process.env.STRIPE_TEST_KEY ?? "";
if (!KEY.startsWith("sk_test_") && !KEY.startsWith("rk_test_")) {
  console.error("Set STRIPE_TEST_KEY to a TEST mode key (sk_test_…). Live keys are refused.");
  process.exit(1);
}

const DAY = 86_400;
const RUN = Date.now().toString(36);

/** Form-encodes nested objects the way Stripe expects: a[b][0]=c. */
function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined) continue;
    if (v !== null && typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe(method, path, body) {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: { authorization: `Bearer ${KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: body ? form(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${json.error?.message ?? res.status}`);
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function advance(clock, toSeconds) {
  await stripe("POST", `/v1/test_helpers/test_clocks/${clock.id}/advance`, { frozen_time: toSeconds });
  for (let i = 0; i < 120; i++) {
    const c = await stripe("GET", `/v1/test_helpers/test_clocks/${clock.id}`);
    if (c.status === "ready") return c;
    await sleep(2000);
  }
  throw new Error("test clock did not finish advancing");
}

async function customer(clock, userId, card) {
  const c = await stripe("POST", "/v1/customers", { test_clock: clock.id, metadata: { user_id: userId }, email: `${userId}@example.com` });
  const pm = await stripe("POST", `/v1/payment_methods/${card}/attach`, { customer: c.id });
  await stripe("POST", `/v1/customers/${c.id}`, { invoice_settings: { default_payment_method: pm.id } });
  return c;
}

async function latestCharge(subscriptionId) {
  const invoices = await stripe("GET", `/v1/invoices?subscription=${subscriptionId}&status=paid&limit=1`);
  const inv = invoices.data[0];
  const payments = await stripe("GET", `/v1/invoice_payments?invoice=${inv.id}&limit=1`);
  const pi = payments.data[0]?.payment?.payment_intent;
  const intent = await stripe("GET", `/v1/payment_intents/${pi}`);
  return intent.latest_charge;
}

async function createWebhook() {
  const url = process.env.FISCALLM_WEBHOOK_URL;
  if (!url) throw new Error("Set FISCALLM_WEBHOOK_URL to the Stripe webhook URL shown on the app's Setup page");
  const events = ["invoice.paid", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "charge.refunded", "charge.dispute.closed"];
  const ep = await stripe("POST", "/v1/webhook_endpoints", { url, enabled_events: events, description: "FiscaLLM e2e" });
  console.log(`Webhook endpoint ${ep.id} created. Paste this signing secret under "Connect Stripe":\n\n  ${ep.secret}\n`);
}

async function main() {
  if (process.argv.includes("--webhook")) return createWebhook();

  const product = await stripe("POST", "/v1/products", { name: `FiscaLLM e2e ${RUN}` });
  const usd = await stripe("POST", "/v1/prices", { product: product.id, currency: "usd", unit_amount: 2000, recurring: { interval: "month" } });
  const eur = await stripe("POST", "/v1/prices", { product: product.id, currency: "eur", unit_amount: 2000, recurring: { interval: "month" } });
  const start = Math.floor(Date.now() / 1000);
  const clock = await stripe("POST", "/v1/test_helpers/test_clocks", { frozen_time: start, name: `fiscallm-e2e-${RUN}` });
  const [a, b, c] = [`e2e-${RUN}-a`, `e2e-${RUN}-b`, `e2e-${RUN}-c`];
  console.log(`Run ${RUN}: users ${a}, ${b}, ${c}`);

  // A: trial, conversion, renewal.
  const custA = await customer(clock, a, "pm_card_visa");
  const subA = await stripe("POST", "/v1/subscriptions", { customer: custA.id, items: [{ price: usd.id }], trial_period_days: 7, metadata: { user_id: a } });
  // B: pays with a card whose charge is disputed.
  const custB = await customer(clock, b, "pm_card_createDispute");
  await stripe("POST", "/v1/subscriptions", { customer: custB.id, items: [{ price: usd.id }], metadata: { user_id: b } });
  // C: pays in EUR.
  const custC = await customer(clock, c, "pm_card_visa");
  await stripe("POST", "/v1/subscriptions", { customer: custC.id, items: [{ price: eur.id }], metadata: { user_id: c } });

  console.log("Advancing 8 days (A's trial converts)…");
  await advance(clock, start + 8 * DAY);
  console.log("Advancing to day 40 (A renews)…");
  await advance(clock, start + 40 * DAY);

  console.log("Refunding $5 of A's latest payment…");
  await stripe("POST", "/v1/refunds", { charge: await latestCharge(subA.id), amount: 500 });

  // B paid at signup and again at the day-30 renewal; every payment is disputed.
  console.log("Losing B's disputes…");
  const charges = new Set((await stripe("GET", `/v1/charges?customer=${custB.id}&limit=10`)).data.map((ch) => ch.id));
  const open = (await stripe("GET", `/v1/disputes?limit=100`)).data.filter((d) => charges.has(d.charge) && d.status !== "lost" && d.status !== "won");
  for (const d of open) await stripe("POST", `/v1/disputes/${d.id}`, { evidence: { uncategorized_text: "losing_evidence" }, submit: true });
  if (open.length !== 2) console.log(`  expected 2 open disputes, found ${open.length}; check Stripe → Disputes`);

  console.log("Cancelling A…");
  await stripe("DELETE", `/v1/subscriptions/${subA.id}`);

  const fee = (x) => x * 0.029 + 0.3;
  console.log(`
Expected in FiscaLLM (Users page, once webhooks arrive):
  ${a}: 2 payments of $20 (trial conversion, renewal) → kept ≈ $${(2 * (20 - fee(20)) - 5).toFixed(2)} after a $5 refund (exact if a key is saved), trial converted, state expired
  ${b}: 2 payments of $20, both disputes lost → kept ≈ $${(2 * (20 - fee(20) - 20)).toFixed(2)}, state paid (the subscription is still active)
  ${c}: 2 payments of €20 → counted only with a saved read-only key, at the USD amount Stripe settled
The app must be in test mode (Setup → Test mode) for these sandbox payments to count.
Stripe objects: product ${product.id}, test clock ${clock.id} (delete the clock to clean up).`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
