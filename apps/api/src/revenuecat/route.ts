import { schema } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AnyDb } from "../ingest/db";
import { webhookSchema } from "./payload";
import { handleWebhook } from "./store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function revenueCatRoute(getDb: () => AnyDb) {
  return new Hono().post("/:appId", async (c) => {
    const appId = c.req.param("appId");
    if (!UUID.test(appId)) return c.json({ error: "unknown app" }, 404);

    const db = getDb();
    const [app] = await db
      .select({ id: schema.apps.id, secret: schema.apps.rcWebhookSecret, testMode: schema.apps.testMode })
      .from(schema.apps)
      .where(eq(schema.apps.id, appId));
    if (!app) return c.json({ error: "unknown app" }, 404);

    // RevenueCat sends the Authorization value exactly as entered in its
    // dashboard; accept it with or without a "Bearer " prefix.
    const auth = (c.req.header("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!safeEqual(auth, app.secret)) return c.json({ error: "invalid authorization" }, 401);

    const parsed = webhookSchema.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) return c.json({ error: "invalid payload" }, 400);

    const result = await handleWebhook(db, app, parsed.data.event);
    // RevenueCat treats anything but 200 as a failure and retries.
    return c.json({ result }, 200);
  });
}
