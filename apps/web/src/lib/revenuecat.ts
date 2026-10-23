import "server-only";
import { schema, sealSecret } from "@fiscallm/shared";
import { importCutoff } from "@fiscallm/shared/rc-import";
import { ensureWebhook, OAUTH_IMPORT_KEY, RcOAuthError, type RcProject } from "@fiscallm/shared/rc-oauth";
import { eq } from "drizzle-orm";
import { getDb, metricsDb } from "./db";
import { origin } from "./origin";

/** Carries the OAuth state and PKCE verifier between the two steps. */
export const RC_OAUTH_COOKIE = "rc_oauth";

/** The site's public URL; the OAuth redirect URI must match it exactly. */
export async function publicUrl() {
  return process.env.PUBLIC_URL ?? (await origin());
}

/**
 * Starts (or restarts) the RevenueCat history import. `key` is a v2 secret
 * key, or OAUTH_IMPORT_KEY to use the app's RevenueCat connection. It is
 * stored sealed while the import runs, then deleted.
 */
export async function beginImport(appId: string, projectId: string, key: string) {
  const secret = process.env.CRON_SECRET!;
  const values = {
    status: "running" as const,
    projectId,
    keyCipher: await sealSecret(secret, key),
    cursor: null,
    cutoff: await importCutoff(metricsDb(), appId),
    customersDone: 0,
    eventsImported: 0,
    error: null,
    lockedUntil: null,
    startedAt: new Date(),
    updatedAt: new Date(),
    finishedAt: null,
  };
  await getDb()
    .insert(schema.rcImports)
    .values({ appId, ...values })
    .onConflictDoUpdate({ target: schema.rcImports.appId, set: values });

  await fetch(`${await origin()}/api/import/rc/run`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ appId }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {});
}

/**
 * Finishes "Connect RevenueCat" for one project: points a webhook at
 * FiscaLLM, records the project, and imports past subscribers.
 */
export async function connectProject(app: { id: string; name: string; rcWebhookSecret: string }, token: string, project: RcProject) {
  let webhookId: string;
  try {
    webhookId = await ensureWebhook(token, project.id, `${await publicUrl()}/api/webhooks/rc/${app.id}`, app.rcWebhookSecret, app.name, app.id);
  } catch (e) {
    // RevenueCat lets the owner grant "Read only", which cannot add a webhook.
    if (e instanceof RcOAuthError && (e.status === 401 || e.status === 403)) {
      await getDb().delete(schema.rcConnections).where(eq(schema.rcConnections.appId, app.id));
      throw new Error(
        'RevenueCat did not allow FiscaLLM to add its webhook. Connect again and choose "Read & Write" permissions, or add the webhook by hand below.',
      );
    }
    throw e;
  }
  await getDb()
    .update(schema.rcConnections)
    .set({ projectId: project.id, projectName: project.name, webhookIntegrationId: webhookId, updatedAt: new Date() })
    .where(eq(schema.rcConnections.appId, app.id));
  await beginImport(app.id, project.id, OAUTH_IMPORT_KEY);
}
