import { schema } from "@fiscallm/shared";
import { and, eq, inArray, or } from "drizzle-orm";
import type { AnyDb } from "../ingest/db";
import type { WebhookEvent } from "./payload";
import { computeSubscriber, netRevenue, type RcEvent } from "./subscriber";

export type Tx = Parameters<Parameters<AnyDb["transaction"]>[0]>[0];

const date = (ms: number | null | undefined) => (ms == null ? null : new Date(ms));
const dec = (n: number | null | undefined) => (n == null ? null : String(n));

export type WebhookResult = "stored" | "duplicate" | "ignored";

/**
 * Stores the raw event (skipping redeliveries), updates the alias map and
 * recomputes the subscribers it touches, in one transaction. Queries run
 * one at a time: Supabase's transaction pooler cannot take pipelined ones.
 */
export async function handleWebhook(
  db: AnyDb,
  app: { id: string; testMode: boolean },
  e: WebhookEvent,
  now = new Date(),
): Promise<WebhookResult> {
  return db.transaction(async (tx) => {
    const price = e.price ?? null;
    const inserted = await tx
      .insert(schema.rcEvents)
      .values({
        appId: app.id,
        id: e.id,
        type: e.type,
        appUserId: e.app_user_id ?? null,
        originalAppUserId: e.original_app_user_id ?? null,
        // On PRODUCT_CHANGE some stores send the new plan separately.
        productId: (e.type === "PRODUCT_CHANGE" ? e.new_product_id : null) ?? e.product_id ?? null,
        periodType: e.period_type ?? null,
        store: e.store ?? null,
        environment: e.environment ?? null,
        priceUsd: dec(price),
        taxPct: dec(e.tax_percentage),
        commissionPct: dec(e.commission_percentage),
        netUsd: dec(netRevenue(price, e.tax_percentage ?? null, e.commission_percentage ?? null)),
        isTrialConversion: e.is_trial_conversion ?? null,
        purchasedAt: date(e.purchased_at_ms),
        expirationAt: date(e.expiration_at_ms),
        eventTs: date(e.event_timestamp_ms) ?? now,
        raw: e,
      })
      .onConflictDoNothing()
      .returning({ id: schema.rcEvents.id });
    if (inserted.length === 0) return "duplicate";

    if (e.type === "TEST") return "ignored";
    if (e.environment === "SANDBOX" && !app.testMode) return "ignored";

    const affected = new Set<string>();

    if (e.type === "TRANSFER") {
      const to = e.transferred_to?.[0];
      if (!to) return "ignored";
      const dest = (await canonicalOf(tx, app.id, to)) ?? to;
      await setAlias(tx, app.id, [to], dest);
      for (const from of e.transferred_from ?? []) {
        const source = (await canonicalOf(tx, app.id, from)) ?? from;
        if (source === dest) continue;
        // Everything known under the source user now belongs to dest.
        await tx
          .update(schema.userAliases)
          .set({ canonicalUserId: dest })
          .where(and(eq(schema.userAliases.appId, app.id), eq(schema.userAliases.canonicalUserId, source)));
        await setAlias(tx, app.id, [from, source], dest);
        affected.add(source);
      }
      affected.add(dest);
    } else {
      const canonical = e.original_app_user_id ?? e.app_user_id;
      if (!canonical) return "ignored";
      const ids = [canonical, e.app_user_id, ...(e.aliases ?? [])].filter((x): x is string => !!x);
      await setAlias(tx, app.id, ids, canonical);
      affected.add(canonical);
    }

    for (const user of affected) await recompute(tx, app, user, now);
    return "stored";
  });
}

async function canonicalOf(tx: Tx, appId: string, alias: string) {
  const [row] = await tx
    .select({ c: schema.userAliases.canonicalUserId })
    .from(schema.userAliases)
    .where(and(eq(schema.userAliases.appId, appId), eq(schema.userAliases.alias, alias)));
  return row?.c;
}

export async function setAlias(tx: Tx, appId: string, aliases: string[], canonical: string) {
  const unique = [...new Set(aliases)];
  if (unique.length === 0) return;
  await tx
    .insert(schema.userAliases)
    .values(unique.map((alias) => ({ appId, alias, canonicalUserId: canonical })))
    .onConflictDoUpdate({
      target: [schema.userAliases.appId, schema.userAliases.alias],
      set: { canonicalUserId: canonical },
    });
}

export async function recompute(tx: Tx, app: { id: string; testMode: boolean }, user: string, now: Date) {
  const aliasRows = await tx
    .select({ alias: schema.userAliases.alias })
    .from(schema.userAliases)
    .where(and(eq(schema.userAliases.appId, app.id), eq(schema.userAliases.canonicalUserId, user)));
  // setAlias always maps a canonical id to itself, so a user with no rows
  // here was merged into someone else (TRANSFER) and has no events left.
  const ids = aliasRows.map((r) => r.alias);

  const r = schema.rcEvents;
  const rows = ids.length === 0 ? [] : await tx
    .select()
    .from(r)
    .where(and(eq(r.appId, app.id), or(inArray(r.originalAppUserId, ids), inArray(r.appUserId, ids))));

  const events: RcEvent[] = rows
    .filter((x) => app.testMode || x.environment !== "SANDBOX")
    .map((x) => ({
      type: x.type,
      eventTs: x.eventTs,
      productId: x.productId,
      periodType: x.periodType,
      purchasedAt: x.purchasedAt,
      expirationAt: x.expirationAt,
      priceUsd: x.priceUsd === null ? null : Number(x.priceUsd),
      netUsd: x.netUsd === null ? null : Number(x.netUsd),
      isTrialConversion: x.isTrialConversion,
    }));

  const s = computeSubscriber(events, now);
  const where = and(eq(schema.subscribers.appId, app.id), eq(schema.subscribers.userId, user));
  if (!s) {
    await tx.delete(schema.subscribers).where(where);
    return;
  }
  const values = {
    state: s.state,
    productId: s.productId,
    trialStartedAt: s.trialStartedAt,
    convertedAt: s.convertedAt,
    expiresAt: s.expiresAt,
    netRevenueUsd: s.netRevenueUsd.toFixed(8),
  };
  await tx
    .insert(schema.subscribers)
    .values({ appId: app.id, userId: user, ...values })
    .onConflictDoUpdate({ target: [schema.subscribers.appId, schema.subscribers.userId], set: values });
}
