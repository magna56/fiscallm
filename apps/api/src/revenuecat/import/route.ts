import { waitUntil } from "@vercel/functions";
import { Hono } from "hono";
import type { AnyDb } from "../../ingest/db";
import { revenueCatApi } from "./client";
import { type MakeApi, runImportChunk } from "./run";

const realApi: MakeApi = (projectId, key, sandbox) => revenueCatApi(projectId, key, { sandbox });

/** Kicks off the next chunk; it answers at once and works in the background. */
export async function triggerImportChunk(baseUrl: string, secret: string, appId: string) {
  await fetch(`${baseUrl}/api/import/rc/run`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ appId }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {});
}

/**
 * Runs one ~50 s chunk of a RevenueCat import, then starts the next, so an
 * import of any size fits within serverless time limits.
 */
export function importRoute(getDb: () => AnyDb, makeApi: MakeApi = realApi) {
  return new Hono().post("/run", async (c) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || c.req.header("authorization") !== `Bearer ${secret}`) return c.json({ error: "unauthorized" }, 401);
    const { appId } = ((await c.req.json().catch(() => ({}))) ?? {}) as { appId?: string };
    if (!appId) return c.json({ error: "appId required" }, 400);

    const baseUrl = process.env.PUBLIC_URL ?? "https://fiscallm.com";
    const work = runImportChunk(getDb(), appId, makeApi, secret)
      .then(async (result) => {
        if (result === "more") await triggerImportChunk(baseUrl, secret, appId);
      })
      .catch((e) => console.error("import chunk failed", e));
    waitUntil(work);
    return c.json({ accepted: true }, 202);
  });
}
