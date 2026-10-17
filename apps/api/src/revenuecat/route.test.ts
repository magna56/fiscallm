import { PGlite } from "@electric-sql/pglite";
import { schema } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Hono } from "hono";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "../ingest/db";
import { revenueCatRoute } from "./route";

const migrationsFolder = fileURLToPath(new URL("../../../../packages/shared/drizzle", import.meta.url));
const SECRET = "whs_test";
const DAY = 86_400_000;

let db: AnyDb;
let appId: string;
let seq = 0;

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder });
  db = pg as unknown as AnyDb;
});

beforeEach(async () => {
  await db.delete(schema.apps);
  const [app] = await db
    .insert(schema.apps)
    .values({ name: "t", ownerId: crypto.randomUUID(), ingestKeyHash: crypto.randomUUID(), rcWebhookSecret: SECRET })
    .returning();
  appId = app!.id;
});

// Recent enough that the default 30-day period has not ended yet.
const t0 = Date.now() - 3 * DAY;

function ev(type: string, over: Record<string, unknown> = {}) {
  return {
    id: `evt_${++seq}`,
    type,
    app_user_id: "user-a",
    original_app_user_id: "$RCAnonymousID:abc",
    aliases: ["$RCAnonymousID:abc", "user-a"],
    product_id: "pro_monthly",
    period_type: "NORMAL",
    environment: "PRODUCTION",
    store: "APP_STORE",
    event_timestamp_ms: t0,
    purchased_at_ms: t0,
    expiration_at_ms: t0 + 30 * DAY,
    price: 0,
    tax_percentage: 0,
    commission_percentage: 0.3,
    ...over,
  };
}

function post(event: unknown, auth = SECRET, id = appId) {
  return new Hono()
    .route("/rc", revenueCatRoute(() => db))
    .request(`/rc/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: auth },
      body: JSON.stringify({ api_version: "1.0", event }),
    });
}

async function send(...events: unknown[]) {
  for (const e of events) expect((await post(e)).status).toBe(200);
}

const subscriber = async (user = "$RCAnonymousID:abc") =>
  (await db.select().from(schema.subscribers).where(eq(schema.subscribers.userId, user)))[0];

describe("POST /webhooks/rc/:appId", () => {
  it("checks the app and the authorization header", async () => {
    expect((await post(ev("TEST"), "wrong")).status).toBe(401);
    expect((await post(ev("TEST"), SECRET, crypto.randomUUID())).status).toBe(404);
    expect((await post(ev("TEST"), SECRET, "not-a-uuid")).status).toBe(404);
    expect((await post(ev("TEST"), `Bearer ${SECRET}`)).status).toBe(200);
  });

  it("follows a trial through conversion, renewal and a refund", async () => {
    const trial = ev("INITIAL_PURCHASE", { period_type: "TRIAL", expiration_at_ms: t0 + 7 * DAY });
    await send(trial);
    let s = await subscriber();
    expect(s).toMatchObject({ state: "trial", productId: "pro_monthly" });
    expect(s!.trialStartedAt!.getTime()).toBe(t0);
    expect(Number(s!.netRevenueUsd)).toBe(0);

    const conversion = ev("RENEWAL", {
      is_trial_conversion: true,
      price: 9.99,
      tax_percentage: 0.1,
      event_timestamp_ms: t0 + 7 * DAY,
      purchased_at_ms: t0 + 7 * DAY,
      expiration_at_ms: t0 + 37 * DAY,
    });
    await send(conversion);
    s = await subscriber();
    expect(s!.state).toBe("paid");
    expect(s!.convertedAt!.getTime()).toBe(t0 + 7 * DAY);
    // 9.99 × (1 − 0.1 − 0.3)
    expect(Number(s!.netRevenueUsd)).toBeCloseTo(5.994, 6);

    await send(ev("CANCELLATION", { cancel_reason: "UNSUBSCRIBE", price: 0, event_timestamp_ms: t0 + 8 * DAY }));
    expect((await subscriber())!.state).toBe("cancelled");

    await send(
      ev("CANCELLATION", { cancel_reason: "CUSTOMER_SUPPORT", price: -9.99, tax_percentage: 0.1, event_timestamp_ms: t0 + 9 * DAY }),
    );
    s = await subscriber();
    expect(s!.state).toBe("expired");
    expect(Number(s!.netRevenueUsd)).toBeCloseTo(0, 6);
  });

  it("ignores redeliveries of the same event", async () => {
    const e = ev("INITIAL_PURCHASE", { price: 4.99 });
    await send(e);
    const res = await post(e);
    expect(await res.json()).toEqual({ result: "duplicate" });
    expect(Number((await subscriber())!.netRevenueUsd)).toBeCloseTo(3.493, 6);
  });

  it("gives the same result when events arrive out of order", async () => {
    const purchase = ev("INITIAL_PURCHASE", { price: 10 });
    const cancel = ev("CANCELLATION", { price: 0, event_timestamp_ms: t0 + DAY });
    await send(cancel, purchase);
    const s = await subscriber();
    expect(s!.state).toBe("cancelled");
    expect(Number(s!.netRevenueUsd)).toBeCloseTo(7, 6);
  });

  it("marks a subscription expired once its period has passed", async () => {
    await send(ev("INITIAL_PURCHASE", { expiration_at_ms: Date.now() - DAY }));
    expect((await subscriber())!.state).toBe("expired");
  });

  it("maps every alias to the original user id", async () => {
    await send(ev("INITIAL_PURCHASE"));
    const aliases = await db.select().from(schema.userAliases).where(eq(schema.userAliases.appId, appId));
    expect(aliases.map((a) => [a.alias, a.canonicalUserId]).sort()).toEqual([
      ["$RCAnonymousID:abc", "$RCAnonymousID:abc"],
      ["user-a", "$RCAnonymousID:abc"],
    ]);
  });

  it("moves a user's history on TRANSFER", async () => {
    await send(ev("INITIAL_PURCHASE", { price: 10 }));
    await send(
      ev("INITIAL_PURCHASE", {
        app_user_id: "user-b",
        original_app_user_id: "user-b",
        aliases: ["user-b"],
        product_id: "pro_yearly",
        price: 0,
        period_type: "TRIAL",
        event_timestamp_ms: t0 + DAY,
      }),
    );
    await send({
      id: `evt_${++seq}`,
      type: "TRANSFER",
      transferred_from: ["user-a"],
      transferred_to: ["user-b"],
      environment: "PRODUCTION",
      event_timestamp_ms: t0 + 2 * DAY,
    });
    expect(await subscriber("$RCAnonymousID:abc")).toBeUndefined();
    const b = await subscriber("user-b");
    expect(Number(b!.netRevenueUsd)).toBeCloseTo(7, 6);
    const aliases = await db.select().from(schema.userAliases);
    expect(new Set(aliases.map((a) => a.canonicalUserId))).toEqual(new Set(["user-b"]));
  });

  it("stores but does not apply sandbox events unless the app is in test mode", async () => {
    await send(ev("INITIAL_PURCHASE", { environment: "SANDBOX", price: 5 }));
    expect(await subscriber()).toBeUndefined();
    expect(await db.select().from(schema.rcEvents)).toHaveLength(1);

    await db.update(schema.apps).set({ testMode: true }).where(eq(schema.apps.id, appId));
    await send(ev("RENEWAL", { environment: "SANDBOX", price: 5, event_timestamp_ms: t0 + DAY }));
    expect(Number((await subscriber())!.netRevenueUsd)).toBeCloseTo(7, 6);
  });

  it("stores unknown and TEST events without failing", async () => {
    await send(ev("TEST"), ev("SOME_FUTURE_EVENT", { brand_new_field: 1 }), ev("BILLING_ISSUE"));
    expect(await db.select().from(schema.rcEvents)).toHaveLength(3);
    expect(await subscriber()).toBeUndefined();
  });

  it("uses the new product on PRODUCT_CHANGE", async () => {
    await send(ev("INITIAL_PURCHASE"), ev("PRODUCT_CHANGE", { new_product_id: "pro_yearly", event_timestamp_ms: t0 + DAY }));
    expect((await subscriber())!.productId).toBe("pro_yearly");
  });

  it("keeps a lifetime buyer paying after a subscription lapses, until refunded", async () => {
    await send(
      ev("NON_RENEWING_PURCHASE", { product_id: "lifetime", expiration_at_ms: null, price: 99 }),
      ev("INITIAL_PURCHASE", { product_id: "pro_yearly", event_timestamp_ms: t0 + DAY, expiration_at_ms: t0 + 2 * DAY }),
    );
    expect(await subscriber()).toMatchObject({ state: "paid", productId: "lifetime", expiresAt: null });

    await send(ev("CANCELLATION", { product_id: "lifetime", price: -99, event_timestamp_ms: t0 + 2 * DAY }));
    expect((await subscriber())!.state).toBe("expired");
  });

  it("rejects a payload without an event id", async () => {
    expect((await post({ type: "RENEWAL" })).status).toBe(400);
  });
});
