"use server";

import { generateIngestKey, generateWebhookSecret, hashKey, schema } from "@fiscallm/shared";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireApp, requireUser } from "@/lib/auth";
import { getDb, metricsDb } from "@/lib/db";
import { origin } from "@/lib/origin";
import { sendWeeklyReport } from "@fiscallm/shared/report/send";
import { keyCookie } from "@/lib/key-cookie";

// The plain ingest key is shown once: kept in a short-lived cookie that
// only the setup page reads, never stored server side.
async function revealKey(appId: string, key: string) {
  (await cookies()).set(keyCookie(appId), key, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/dashboard",
    maxAge: 600,
  });
}

export async function createApp(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  if (!name) redirect("/dashboard?error=Enter+a+name");

  const key = generateIngestKey();
  const [app] = await getDb()
    .insert(schema.apps)
    .values({
      name,
      ownerId: user.id,
      ingestKeyHash: await hashKey(key),
      rcWebhookSecret: generateWebhookSecret(),
    })
    .returning({ id: schema.apps.id });
  await revealKey(app!.id, key);
  redirect(`/dashboard/${app!.id}/setup`);
}

export async function rotateKey(appId: string) {
  const app = await requireApp(appId);
  const key = generateIngestKey();
  await getDb()
    .update(schema.apps)
    .set({ ingestKeyHash: await hashKey(key) })
    .where(eq(schema.apps.id, app.id));
  await revealKey(app.id, key);
  redirect(`/dashboard/${app.id}/setup`);
}

export async function dismissKey(appId: string) {
  const app = await requireApp(appId);
  (await cookies()).delete({ name: keyCookie(app.id), path: "/dashboard" });
  revalidatePath(`/dashboard/${app.id}/setup`);
}

export async function rotateWebhookSecret(appId: string) {
  const app = await requireApp(appId);
  await getDb()
    .update(schema.apps)
    .set({ rcWebhookSecret: generateWebhookSecret() })
    .where(eq(schema.apps.id, app.id));
  revalidatePath(`/dashboard/${app.id}`, "layout");
}

export async function setTestMode(appId: string, on: boolean) {
  const app = await requireApp(appId);
  await getDb().update(schema.apps).set({ testMode: on }).where(eq(schema.apps.id, app.id));
  revalidatePath(`/dashboard/${app.id}`, "layout");
}

const price = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? String(n) : undefined;
};

export async function addOverride(appId: string, formData: FormData) {
  const app = await requireApp(appId);
  const settings = `/dashboard/${app.id}/settings`;
  const fail = (msg: string): never => redirect(`${settings}?error=${encodeURIComponent(msg)}`);

  const provider = String(formData.get("provider") ?? "").trim().toLowerCase();
  const model = String(formData.get("model") ?? "").trim().toLowerCase() || "*";
  const effectiveFrom = String(formData.get("effectiveFrom") ?? "").trim() || new Date().toISOString().slice(0, 10);
  const discount = price(formData.get("discountPct"));
  const input = price(formData.get("inputPerMtok"));
  const output = price(formData.get("outputPerMtok"));
  const cached = price(formData.get("cachedPerMtok"));

  if (!provider) fail("Enter a provider, e.g. openai");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) fail("Enter the start date as YYYY-MM-DD");
  if ([discount, input, output, cached].includes(undefined)) fail("Prices and discounts must be positive numbers");
  const flat = input !== null || output !== null;
  if (flat && (input === null || output === null)) fail("Enter both the input and output price");
  if (flat && model === "*") fail("Your own prices need a specific model");
  if (!flat && discount === null) fail("Enter a discount or your own prices");
  if (discount !== null && Number(discount) > 100) fail("A discount is at most 100%");

  await getDb()
    .insert(schema.appPriceOverrides)
    .values({
      appId: app.id,
      provider,
      model,
      effectiveFrom,
      discountPct: flat ? null : discount,
      inputPerMtok: input ?? null,
      outputPerMtok: output ?? null,
      cachedPerMtok: cached ?? null,
    })
    .onConflictDoNothing();
  redirect(settings);
}

export async function deleteOverride(appId: string, provider: string, model: string, effectiveFrom: string) {
  const app = await requireApp(appId);
  const o = schema.appPriceOverrides;
  await getDb()
    .delete(o)
    .where(and(eq(o.appId, app.id), eq(o.provider, provider), eq(o.model, model), eq(o.effectiveFrom, effectiveFrom)));
  revalidatePath(`/dashboard/${app.id}/settings`);
}

/** Removes all events and derived data but keeps the app and its keys. */
export async function deleteAppData(appId: string, formData: FormData) {
  const app = await requireApp(appId);
  if (String(formData.get("confirm") ?? "") !== app.name) {
    redirect(`/dashboard/${app.id}/settings?error=Type+the+app+name+to+confirm`);
  }
  const db = getDb();
  await db.transaction(async (tx) => {
    // One statement at a time: see lib/db.ts.
    for (const t of [schema.aiEvents, schema.dailyUserCost, schema.rcEvents, schema.subscribers, schema.userAliases]) {
      await tx.delete(t).where(eq(t.appId, app.id));
    }
  });
  redirect(`/dashboard/${app.id}/settings?done=Data+deleted`);
}

export async function deleteApp(appId: string, formData: FormData) {
  const app = await requireApp(appId);
  if (String(formData.get("confirm") ?? "") !== app.name) {
    redirect(`/dashboard/${app.id}/settings?error=Type+the+app+name+to+confirm`);
  }
  // Cascades to every table keyed by the app.
  await getDb().delete(schema.apps).where(eq(schema.apps.id, app.id));
  redirect("/dashboard");
}

export async function setWeeklyEmail(appId: string, on: boolean) {
  const app = await requireApp(appId);
  await getDb().update(schema.apps).set({ weeklyEmail: on }).where(eq(schema.apps.id, app.id));
  revalidatePath(`/dashboard/${app.id}/settings`);
}

/** Sends last week's report to the signed-in owner now. */
export async function sendTestReport(appId: string) {
  const app = await requireApp(appId);
  const user = await requireUser();
  const settings = `/dashboard/${app.id}/settings`;
  const resendApiKey = process.env.RESEND_API_KEY;
  const signingSecret = process.env.CRON_SECRET;
  if (!resendApiKey || !signingSecret || !user.email) redirect(`${settings}?error=Email+is+not+configured+yet`);

  const result = await sendWeeklyReport(metricsDb(), app, user.email!, {
    resendApiKey: resendApiKey!,
    signingSecret: signingSecret!,
    baseUrl: await origin(),
  });
  if (result === "sent") redirect(`${settings}?done=${encodeURIComponent(`Report sent to ${user.email}`)}`);
  if (result === "no-activity") redirect(`${settings}?error=No+activity+in+the+last+7+days,+so+there+is+nothing+to+report`);
  redirect(`${settings}?error=${encodeURIComponent(result.error)}`);
}
