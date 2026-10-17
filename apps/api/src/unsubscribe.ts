import { schema, verifyUnsubscribeToken } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AnyDb } from "./ingest/db";

const page = (message: string) =>
  `<!doctype html><meta name="viewport" content="width=device-width"><title>FiscaLLM</title>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 16px">
<h1 style="font-size:20px">FiscaLLM</h1><p>${message}</p></body>`;

/**
 * The link in the weekly email. GET from the link, POST for mail clients'
 * one-click unsubscribe (RFC 8058). Turn emails back on in Settings.
 */
export function unsubscribeRoute(getDb: () => AnyDb) {
  const handle = async (appId: string | undefined, token: string | undefined) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || !appId || !token || !(await verifyUnsubscribeToken(secret, appId, token))) return false;
    await getDb().update(schema.apps).set({ weeklyEmail: false }).where(eq(schema.apps.id, appId));
    return true;
  };
  return new Hono()
    .get("/", async (c) =>
      (await handle(c.req.query("app"), c.req.query("t")))
        ? c.html(page("You will no longer get the weekly report for this app. You can turn it back on in the app's Settings."))
        : c.html(page("This link is not valid."), 400),
    )
    .post("/", async (c) => ((await handle(c.req.query("app"), c.req.query("t"))) ? c.body(null, 200) : c.body(null, 400)));
}
