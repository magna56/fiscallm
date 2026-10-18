"use server";

import { generateIngestKey, generateWebhookSecret, hashKey, schema, sealSecret } from "@fiscallm/shared";
import { importCutoff } from "@fiscallm/shared/rc-import";
import { ALERT_KINDS, type AlertKind } from "@fiscallm/shared/schema";
import { describeAlert, signWebhook, webhookPayload } from "@fiscallm/shared/alerts";
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

/**
 * Starts importing past subscribers from RevenueCat's API. The key is
 * checked, stored encrypted while the import runs, then deleted.
 */
export async function startImport(appId: string, formData: FormData) {
  const app = await requireApp(appId);
  const settings = `/dashboard/${app.id}/settings`;
  const fail = (msg: string): never => redirect(`${settings}?error=${encodeURIComponent(msg)}#import`);
  const secret = process.env.CRON_SECRET;
  if (!secret) fail("Imports are not configured yet");

  const projectId = String(formData.get("projectId") ?? "").trim();
  const key = String(formData.get("secretKey") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(projectId)) fail("Enter your RevenueCat project ID (Project settings → General)");
  if (!key.startsWith("sk_")) fail("Enter a RevenueCat v2 secret key; it starts with sk_");

  // Check the key and project before storing anything.
  const check = await fetch(`https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/customers?limit=1`, {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!check) fail("Could not reach RevenueCat; try again");
  if (check!.status === 401 || check!.status === 403) fail("RevenueCat refused the key. Use a v2 secret key with read-only access to Customer information and Project configuration.");
  if (check!.status === 404) fail("RevenueCat did not find that project ID");
  if (!check!.ok) fail(`RevenueCat answered ${check!.status}`);

  const db = getDb();
  const values = {
    status: "running" as const,
    projectId,
    keyCipher: await sealSecret(secret!, key),
    cursor: null,
    cutoff: await importCutoff(metricsDb(), app.id),
    customersDone: 0,
    eventsImported: 0,
    error: null,
    lockedUntil: null,
    startedAt: new Date(),
    updatedAt: new Date(),
    finishedAt: null,
  };
  await db
    .insert(schema.rcImports)
    .values({ appId: app.id, ...values })
    .onConflictDoUpdate({ target: schema.rcImports.appId, set: values });

  await fetch(`${await origin()}/api/import/rc/run`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ appId: app.id }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {});
  redirect(`${settings}#import`);
}

export async function cancelImport(appId: string) {
  const app = await requireApp(appId);
  await getDb()
    .update(schema.rcImports)
    .set({ status: "cancelled", keyCipher: null, finishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.rcImports.appId, app.id), eq(schema.rcImports.status, "running")));
  revalidatePath(`/dashboard/${app.id}/settings`);
}

const USD_KINDS = new Set(["user_daily_cost", "user_30d_cost", "user_losing", "app_daily_cost"]);

export async function addAlertRule(appId: string, formData: FormData) {
  const app = await requireApp(appId);
  const settings = `/dashboard/${app.id}/settings`;
  const fail = (msg: string): never => redirect(`${settings}?error=${encodeURIComponent(msg)}#alerts`);

  const kind = String(formData.get("kind") ?? "") as AlertKind;
  if (!ALERT_KINDS.includes(kind)) fail("Choose an alert type");
  const raw = String(formData.get("threshold") ?? "").trim();
  let threshold: string | null = null;
  if (kind !== "unpriced_model") {
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || n <= 0) fail(USD_KINDS.has(kind) ? "Enter an amount in USD above 0" : "Enter a percentage above 0");
    threshold = String(kind === "app_cost_share" ? n / 100 : n);
  }
  const email = formData.get("email") === "on";
  const webhookUrl = String(formData.get("webhookUrl") ?? "").trim() || null;
  if (webhookUrl && !/^https:\/\/[^\s]+$/.test(webhookUrl)) fail("The webhook URL must start with https://");
  if (!email && !webhookUrl) fail("Choose email, a webhook, or both");

  const db = getDb();
  if (webhookUrl && !app.alertSecret) {
    await db.update(schema.apps).set({ alertSecret: generateWebhookSecret() }).where(eq(schema.apps.id, app.id));
  }
  await db.insert(schema.alertRules).values({ appId: app.id, kind, threshold, email, webhookUrl });
  redirect(`${settings}#alerts`);
}

export async function setAlertRuleEnabled(appId: string, ruleId: string, enabled: boolean) {
  const app = await requireApp(appId);
  await getDb()
    .update(schema.alertRules)
    .set({ enabled })
    .where(and(eq(schema.alertRules.id, ruleId), eq(schema.alertRules.appId, app.id)));
  revalidatePath(`/dashboard/${app.id}/settings`);
}

export async function deleteAlertRule(appId: string, ruleId: string) {
  const app = await requireApp(appId);
  await getDb()
    .delete(schema.alertRules)
    .where(and(eq(schema.alertRules.id, ruleId), eq(schema.alertRules.appId, app.id)));
  revalidatePath(`/dashboard/${app.id}/settings`);
}

/** Sends a sample alert through a rule's channels, outside the once-a-day limit. */
export async function sendTestAlert(appId: string, ruleId: string) {
  const app = await requireApp(appId);
  const user = await requireUser();
  const settings = `/dashboard/${app.id}/settings`;
  const [rule] = await getDb()
    .select()
    .from(schema.alertRules)
    .where(and(eq(schema.alertRules.id, ruleId), eq(schema.alertRules.appId, app.id)));
  if (!rule) redirect(`${settings}#alerts`);
  const sample = {
    rule: rule!,
    subject: rule!.kind.startsWith("user") ? "test-user" : rule!.kind === "unpriced_model" ? "example/model" : "app",
    period: new Date().toISOString().slice(0, 10),
    value: rule!.kind === "app_cost_share" ? Number(rule!.threshold) * 1.2 : rule!.kind === "user_losing" ? -Number(rule!.threshold) * 1.5 : Number(rule!.threshold ?? 1) * 1.5,
    threshold: rule!.threshold === null ? null : Number(rule!.threshold),
  };
  const results: string[] = [];
  if (rule!.email && process.env.RESEND_API_KEY && user.email) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM_ALERTS ?? "FiscaLLM <alerts@fiscallm.com>",
        to: [user.email],
        subject: `[Test] ${app.name}: ${describeAlert(sample)}`,
        text: `This is a test of your FiscaLLM alert.\n\n${describeAlert(sample)}`,
      }),
    }).catch(() => null);
    results.push(res?.ok ? `email sent to ${user.email}` : "email failed");
  }
  if (rule!.webhookUrl && app.alertSecret) {
    const body = JSON.stringify({ ...webhookPayload(app, sample), test: true });
    const res = await fetch(rule!.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-fiscallm-signature": await signWebhook(app.alertSecret, body) },
      body,
      signal: AbortSignal.timeout(5_000),
    }).catch(() => null);
    results.push(res ? `webhook answered ${res.status}` : "webhook unreachable");
  }
  redirect(`${settings}?done=${encodeURIComponent(`Test alert: ${results.join(", ") || "nothing to send"}`)}#alerts`);
}

/** Saves the Stripe webhook signing secret (sealed), which turns the Stripe connection on. */
export async function connectStripe(appId: string, formData: FormData) {
  const app = await requireApp(appId);
  const back = `/dashboard/${app.id}/setup`;
  const fail = (msg: string): never => redirect(`${back}?error=${encodeURIComponent(msg)}#stripe`);
  const server = process.env.CRON_SECRET;
  if (!server) fail("Stripe is not configured on this server yet");
  const secret = String(formData.get("signingSecret") ?? "").trim();
  if (!/^whsec_[A-Za-z0-9_+/=-]{16,}$/.test(secret)) {
    fail("Paste the signing secret of the Stripe webhook endpoint; it starts with whsec_");
  }
  await getDb()
    .update(schema.apps)
    .set({ stripeWebhookSecretCipher: await sealSecret(server!, secret) })
    .where(eq(schema.apps.id, app.id));
  revalidatePath(back);
  redirect(`${back}?done=${encodeURIComponent("Stripe connected. Send a test event from Stripe to check it.")}#stripe`);
}

export async function disconnectStripe(appId: string) {
  const app = await requireApp(appId);
  const back = `/dashboard/${app.id}/setup`;
  await getDb().update(schema.apps).set({ stripeWebhookSecretCipher: null }).where(eq(schema.apps.id, app.id));
  revalidatePath(back);
  redirect(`${back}?done=${encodeURIComponent("Stripe disconnected. Existing data is kept.")}#stripe`);
}
