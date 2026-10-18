import { openSecret, schema } from "@fiscallm/shared";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AnyDb } from "../ingest/db";
import type { RowSource } from "../revenue/convert";
import { storeRevenueEvents } from "../revenue/route";
import { type MapContext, mapStripeEvent } from "./map";
import { verifyStripeSignature } from "./verify";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 1024 * 1024;

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
      .select({ id: schema.apps.id, testMode: schema.apps.testMode, cipher: schema.apps.stripeWebhookSecretCipher })
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

    const ctx: MapContext = {
      async knownUser(customerId) {
        const [row] = await db
          .select({ u: schema.rcEvents.appUserId })
          .from(schema.rcEvents)
          .where(and(eq(schema.rcEvents.appId, app.id), sql`${schema.rcEvents.raw}->>'stripeCustomer' = ${customerId}`, sql`${schema.rcEvents.appUserId} <> ${customerId}`))
          .orderBy(sql`${schema.rcEvents.eventTs} desc`)
          .limit(1);
        return row?.u ?? null;
      },
      async refundedSoFar(chargeId) {
        const [row] = await db
          .select({ n: sql<string>`coalesce(sum(-${schema.rcEvents.priceUsd}), 0)` })
          .from(schema.rcEvents)
          .where(and(eq(schema.rcEvents.appId, app.id), sql`${schema.rcEvents.raw}->>'stripeCharge' = ${chargeId}`, sql`${schema.rcEvents.priceUsd} < 0`));
        return Number(row?.n ?? 0);
      },
    };

    const mapped = await mapStripeEvent(event as Record<string, unknown>, ctx);
    if (mapped.events.length === 0) return c.json({ received: true, ignored: mapped.ignored }, 200);

    // The first payment after a trial is the conversion.
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
    const result = await storeRevenueEvents(db, app, mapped.events, src);
    return c.json({ received: true, ...result }, 200);
  });
}
