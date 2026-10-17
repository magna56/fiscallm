import { openSecret, schema } from "@fiscallm/shared";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { AnyDb } from "../../ingest/db";
import { recompute, setAlias } from "../store";
import { type RcApi, RcApiError, TRANSACTION_STORES } from "./client";
import { convertCustomer } from "./convert";

export type MakeApi = (projectId: string, secretKey: string, sandbox: boolean) => RcApi;
export type ChunkResult = "more" | "done" | "stopped" | "busy";

/**
 * Imports customers until the time budget runs out, saving progress after
 * each one, so the next chunk resumes where this one stopped.
 */
export async function runImportChunk(
  db: AnyDb,
  appId: string,
  makeApi: MakeApi,
  serverSecret: string,
  budgetMs = 50_000,
  now = () => new Date(),
): Promise<ChunkResult> {
  const deadline = Date.now() + budgetMs;
  const imp = schema.rcImports;

  // Claim the import; another chunk holding the lock means we are not needed.
  const lockUntil = new Date(Date.now() + budgetMs + 30_000);
  const [job] = await db
    .update(imp)
    .set({ lockedUntil: lockUntil })
    .where(and(eq(imp.appId, appId), eq(imp.status, "running"), or(isNull(imp.lockedUntil), lt(imp.lockedUntil, now()))))
    .returning();
  if (!job) {
    const [current] = await db.select({ status: imp.status }).from(imp).where(eq(imp.appId, appId));
    return current?.status === "running" ? "busy" : "stopped";
  }

  const [app] = await db.select({ id: schema.apps.id, testMode: schema.apps.testMode }).from(schema.apps).where(eq(schema.apps.id, appId));
  if (!app || !job.keyCipher) return finish(db, appId, "failed", "The import lost its key; start it again.");

  let api: RcApi;
  try {
    api = makeApi(job.projectId, await openSecret(serverSecret, job.keyCipher), app.testMode);
  } catch {
    return finish(db, appId, "failed", "Could not read the stored key; start the import again.");
  }

  let cursor = job.cursor;
  try {
    const productNames = await api.productNames();
    for (;;) {
      const page = await api.customers(cursor);
      for (const customerId of page.ids) {
        const aliases = await api.aliases(customerId);
        const subscriptions = [];
        for (const subscription of await api.subscriptions(customerId)) {
          // Only App Store and Play Store have per-transaction history.
          const transactions = TRANSACTION_STORES.has(subscription.store) ? await api.transactions(subscription.id) : null;
          subscriptions.push({ subscription, transactions });
        }
        const purchases = await api.purchases(customerId);
        const rows = convertCustomer(appId, { customerId, subscriptions, purchases }, job.cutoff, productNames);

        await db.transaction(async (tx) => {
          let added = 0;
          if (rows.length > 0) {
            // Re-imports only fix product names (e.g. once the key may read
            // products); unchanged rows are left alone and not counted.
            added = (
              await tx
                .insert(schema.rcEvents)
                .values(rows)
                .onConflictDoUpdate({
                  target: [schema.rcEvents.appId, schema.rcEvents.id],
                  set: { productId: sql`excluded.product_id` },
                  setWhere: sql`${schema.rcEvents.productId} IS DISTINCT FROM excluded.product_id`,
                })
                .returning({ id: schema.rcEvents.id })
            ).length;
          }
          // Keep the canonical id webhooks may already have chosen.
          const [known] = await tx
            .select({ c: schema.userAliases.canonicalUserId })
            .from(schema.userAliases)
            .where(and(eq(schema.userAliases.appId, appId), eq(schema.userAliases.alias, customerId)));
          const canonical = known?.c ?? customerId;
          await setAlias(tx, appId, [customerId, ...aliases], canonical);
          await recompute(tx, app, canonical, now());
          await tx
            .update(imp)
            .set({
              cursor: customerId,
              customersDone: sql`${imp.customersDone} + 1`,
              eventsImported: sql`${imp.eventsImported} + ${added}`,
              updatedAt: now(),
            })
            .where(eq(imp.appId, appId));
        });
        cursor = customerId;
        if (Date.now() > deadline) {
          await db.update(imp).set({ lockedUntil: null }).where(eq(imp.appId, appId));
          return "more";
        }
      }
      if (!page.more) return finish(db, appId, "done", null);
      if (page.ids.length === 0) return finish(db, appId, "done", null);
    }
  } catch (e) {
    const message =
      e instanceof RcApiError && (e.status === 401 || e.status === 403)
        ? "RevenueCat refused the key. Check that it is a v2 secret key with read access to customers, subscriptions and purchases."
        : e instanceof RcApiError && e.status === 404
          ? "RevenueCat did not find that project ID."
          : `Import stopped: ${(e as Error).message}`.slice(0, 500);
    return finish(db, appId, "failed", message);
  }
}

async function finish(db: AnyDb, appId: string, status: "done" | "failed", error: string | null): Promise<ChunkResult> {
  // The key is only kept while the import runs.
  await db
    .update(schema.rcImports)
    .set({ status, error, keyCipher: null, lockedUntil: null, finishedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.rcImports.appId, appId));
  return status === "done" ? "done" : "stopped";
}
