import { openSecret, schema } from "@fiscallm/shared";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AnyDb } from "../ingest/db";
import type { RowSource } from "../revenue/convert";
import { storeRevenueEvents } from "../revenue/route";
import { type MapContext, type Mapped, mapStripeEvent } from "./map";
import { customerOfCharge, settle, type StripeRequest, stripeRequest } from "./settlement";
import { verifyStripeSignature } from "./verify";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 1024 * 1024;

type App = { id: string; testMode: boolean };

/** Lookups the mapper needs: what is already stored, and Stripe itself when a read-only key is connected. */
export function stripeContext(db: AnyDb, appId: string, req?: StripeRequest): MapContext {
  const e = schema.rcEvents;
  return {
    ...(req ? { settle: (ref) => settle(req, ref), customerOfCharge: (chargeId) => customerOfCharge(req, chargeId) } : {}),
    async userForCharge(chargeId) {
      const [row] = await db
        .select({ u: e.appUserId })
        .from(e)
        .where(and(eq(e.appId, appId), sql`${e.raw}->>'stripeCharge' = ${chargeId}`, sql`${e.priceUsd} > 0`))
        .limit(1);
      return row?.u ?? null;
    },
    async knownUser(customerId) {
      const [row] = await db
        .select({ u: e.appUserId })
        .from(e)
        .where(and(eq(e.appId, appId), sql`${e.raw}->>'stripeCustomer' = ${customerId}`, sql`${e.appUserId} <> ${customerId}`))
        .orderBy(sql`${e.eventTs} desc`)
        .limit(1);
      return row?.u ?? null;
    },
    async refundedSoFar(chargeId) {
      const [row] = await db
        .select({ n: sql<string>`coalesce(sum(-${e.priceUsd}), 0)` })
        .from(e)
        .where(and(eq(e.appId, appId), sql`${e.raw}->>'stripeCharge' = ${chargeId}`, sql`${e.priceUsd} < 0`));
      return Number(row?.n ?? 0);
    },
    async invoiceSeen(invoiceId) {
      const [row] = await db
        .select({ id: e.id })
        .from(e)
        .where(and(eq(e.appId, appId), sql`${e.raw}->>'stripeInvoice' = ${invoiceId}`))
        .limit(1);
      return Boolean(row);
    },
  };
}

/** Stores mapped Stripe events; the first payment after a trial is the conversion. */
export async function storeStripeEvents(db: AnyDb, app: App, mapped: Mapped) {
  for (const e of mapped.events) {
    if (e.type !== "renewal") continue;
    const [sub] = await db
      .select({ state: schema.subscribers.state })
      .from(schema.subscribers)
      .where(and(eq(schema.subscribers.appId, app.id), eq(schema.subscribers.userId, e.userId)))
      .limit(1);
    if (sub?.state === "trial") e.isTrialConversion = true;
  }
  const src: RowSource = { store: "STRIPE", idPrefix: "stripe", rawSource: "stripe", extra: mapped.extra };
  return storeRevenueEvents(db, app, mapped.events, src);
}

/**
 * POST /api/webhooks/stripe/:appId. Stripe signs the body with the endpoint's
 * signing secret, which the app owner pasted into FiscaLLM (stored sealed).
 */
export function stripeRoute(getDb: () => AnyDb) {
  return new Hono().post("/:appId", async (c) => {
    const appId = c.req.param("appId");
    if (!UUID.test(appId)) return c.json({ error: "unknown app" }, 404);
    if (Number(c.req.header("content-length") ?? 0) > MAX_BODY_BYTES) return c.json({ error: "body too large" }, 413);

    const db = getDb();
    const [app] = await db
      .select({
        id: schema.apps.id,
        testMode: schema.apps.testMode,
        cipher: schema.apps.stripeWebhookSecretCipher,
        keyCipher: schema.apps.stripeApiKeyCipher,
      })
      .from(schema.apps)
      .where(eq(schema.apps.id, appId))
      .limit(1);
    if (!app?.cipher) return c.json({ error: "Stripe is not connected for this app" }, 404);

    const serverSecret = process.env.CRON_SECRET;
    if (!serverSecret) return c.json({ error: "server is not configured" }, 500);
    const body = await c.req.text();
    const signingSecret = await openSecret(serverSecret, app.cipher).catch(() => "");
    if (!(await verifyStripeSignature(body, c.req.header("stripe-signature"), signingSecret))) {
      return c.json({ error: "invalid signature" }, 400);
    }

    let event: unknown;
    try {
      event = JSON.parse(body);
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }

    const apiKey = app.keyCipher ? await openSecret(serverSecret, app.keyCipher).catch(() => null) : null;
    const mapped = await mapStripeEvent(event as Record<string, unknown>, stripeContext(db, app.id, apiKey ? stripeRequest(apiKey) : undefined));
    if (mapped.events.length === 0) return c.json({ received: true, ignored: mapped.ignored }, 200);
    const result = await storeStripeEvents(db, app, mapped);
    return c.json({ received: true, ...result }, 200);
  });
}
