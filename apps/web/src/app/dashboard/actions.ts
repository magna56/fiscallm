"use server";

import { generateIngestKey, generateWebhookSecret, hashKey, openSecret, schema, sealSecret } from "@fiscallm/shared";
import { ALERT_KINDS, type AlertKind } from "@fiscallm/shared/schema";
import { describeAlert, isSlackWebhook, signWebhook, slackPayload, webhookPayload } from "@fiscallm/shared/alerts";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireApp, requireUser } from "@/lib/auth";
import { getDb, metricsDb } from "@/lib/db";
import { origin } from "@/lib/origin";
import { sendWeeklyReport } from "@fiscallm/shared/report/send";
import { keyCookie } from "@/lib/key-cookie";
import { beginImport, connectProject } from "@/lib/revenuecat";
import { accessToken, deleteWebhook, listProjects, oauthClient } from "@fiscallm/shared/rc-oauth";

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

  await beginImport(app.id, projectId, key);
  redirect(`${settings}#import`);
}

/** Second step of "Connect RevenueCat" when the account has several projects. */
export async function chooseRevenueCatProject(appId: string, formData: FormData) {
  const app = await requireApp(appId);
  const setup = `/dashboard/${app.id}/setup`;
  const fail = (msg: string): never => redirect(`${setup}?error=${encodeURIComponent(msg)}#revenue`);
  const client = oauthClient();
  const secret = process.env.CRON_SECRET;
  if (!client || !secret) fail("Connect RevenueCat is not configured");
  const projectId = String(formData.get("projectId") ?? "");
  try {
    const token = await accessToken(metricsDb(), secret!, client!, app.id);
    if (!token) fail("Connect RevenueCat again");
    const project = (await listProjects(token!)).find((p) => p.id === projectId);
    if (!project) fail("Choose one of your RevenueCat projects");
    await connectProject(app, token!, project!);
  } catch (e) {
    unstable_rethrow(e);
    fail(`Could not finish connecting RevenueCat: ${(e as Error).message}`);
  }
  redirect(`${setup}?done=${encodeURIComponent("RevenueCat connected. The webhook is set up and past subscribers are importing.")}#revenue`);
}

/** Removes FiscaLLM's webhook from RevenueCat (best effort) and forgets the tokens. */
export async function disconnectRevenueCat(appId: string) {
  const app = await requireApp(appId);
  const db = getDb();
  const [conn] = await db.select().from(schema.rcConnections).where(eq(schema.rcConnections.appId, app.id));
  const client = oauthClient();
  const secret = process.env.CRON_SECRET;
  if (conn?.projectId && conn.webhookIntegrationId && client && secret) {
    try {
      const token = await accessToken(metricsDb(), secret, client, app.id);
      if (token) await deleteWebhook(token, conn.projectId, conn.webhookIntegrationId);
    } catch {
      // Still disconnect; the owner can delete the webhook in RevenueCat.
    }
  }
  // An import running on this connection cannot continue without it.
  await db
    .update(schema.rcImports)
    .set({ status: "cancelled", keyCipher: null, finishedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.rcImports.appId, app.id), eq(schema.rcImports.status, "running")));
  await db.delete(schema.rcConnections).where(eq(schema.rcConnections.appId, app.id));
  redirect(`/dashboard/${app.id}/setup?done=${encodeURIComponent("RevenueCat disconnected.")}#revenue`);
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
    if (!raw || !Number.isFinite(n) || n <= 0) {
      fail(kind === "user_burst" ? "Enter a number of tokens above 0 (for example 50000)" : USD_KINDS.has(kind) ? "Enter an amount in USD above 0" : "Enter a percentage above 0");
    }
    threshold = String(kind === "app_cost_share" ? n / 100 : kind === "user_burst" ? Math.round(n) : n);
  }
  const email = formData.get("email") === "on";
  const webhookUrl = String(formData.get("webhookUrl") ?? "").trim() || null;
  if (webhookUrl && !/^https:\/\/[^\s]+$/.test(webhookUrl)) fail("The webhook URL must start with https://");
  if (!email && !webhookUrl) fail("Choose email, a webhook, or both");

  const db = getDb();
  if (webhookUrl && !app.alertSecret) {
    await db.update(schema.apps).set({ alertSecret: generateWebhookSecret() }).where(eq(schema.apps.id, app.id));
  }
  // Only a user's own budget can refuse calls; ignore the box for other kinds.
  const enforce = formData.get("enforce") === "on" && (kind === "user_daily_cost" || kind === "user_30d_cost");
  await db.insert(schema.alertRules).values({ appId: app.id, kind, threshold, email, webhookUrl, enforce });
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
  if (rule!.webhookUrl && isSlackWebhook(rule!.webhookUrl)) {
    const base = process.env.PUBLIC_URL ?? "https://fiscallm.com";
    const slack = slackPayload(app, sample, base);
    const res = await fetch(rule!.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `[Test] ${slack.text}` }),
      signal: AbortSignal.timeout(5_000),
    }).catch(() => null);
    results.push(res ? `Slack answered ${res.status}` : "Slack unreachable");
  } else if (rule!.webhookUrl && app.alertSecret) {
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

/** Imports revenue from a CSV file (payments that never came through a webhook). */
export async function uploadRevenueCsv(appId: string, formData: FormData) {
  const app = await requireApp(appId);
  const back = `/dashboard/${app.id}/setup`;
  const fail = (msg: string): never => redirect(`${back}?error=${encodeURIComponent(msg)}#csv`);
  const secret = process.env.CRON_SECRET;
  if (!secret) fail("CSV import is not configured on this server yet");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) fail("Choose a CSV file");
  // Server Actions accept 1 MB bodies; about 5,000 rows fit.
  if ((file as File).size > 950_000) fail("The file is over 950 KB; split it into smaller files");

  const res = await fetch(`${await origin()}/api/import/revenue-csv`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ appId: app.id, csv: await (file as File).text() }),
    signal: AbortSignal.timeout(60_000),
  }).catch(() => null);
  if (!res) fail("The import did not finish; try again (rows already stored are skipped)");
  const out = (await res!.json().catch(() => ({}))) as {
    error?: string;
    accepted?: number;
    duplicates?: number;
    skipped?: number;
    errors?: { row: number; message: string }[];
  };
  if (!res!.ok) fail(out.error ?? `Import failed (${res!.status})`);

  const parts = [`Imported ${out.accepted ?? 0} rows`];
  if (out.duplicates) parts.push(`${out.duplicates} already there`);
  if (out.skipped) {
    const first = out.errors?.slice(0, 3).map((e) => `line ${e.row}: ${e.message}`).join("; ");
    parts.push(`${out.skipped} skipped (${first}${out.skipped > 3 ? "; …" : ""})`);
  }
  revalidatePath(`/dashboard/${app.id}`, "layout");
  const msg = parts.join(", ") + ".";
  redirect(`${back}?${out.skipped && !out.accepted ? "error" : "done"}=${encodeURIComponent(msg)}#csv`);
}

const STRIPE_KEY = /^(rk|sk)_(live|test)_[A-Za-z0-9]{10,}$/;
const STRIPE_READ_ACCESS = "Read access to Invoices, Charges and Refunds, PaymentIntents, Balance transactions, and Subscriptions";

/** Checks a Stripe key can read each path; returns what is wrong, or null. */
async function checkStripeKey(key: string, paths: string[]): Promise<string | null> {
  for (const path of paths) {
    const check = await fetch(`https://api.stripe.com${path}?limit=1`, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!check) return "Could not reach Stripe; try again";
    if (check.status === 401) return "Stripe refused the key";
    if (check.status === 403) return `The key cannot read ${path.replace("/v1/", "").replace("_", " ")}. Give it ${STRIPE_READ_ACCESS}.`;
    if (!check.ok) return `Stripe answered ${check.status}`;
  }
  return null;
}

/**
 * Saves a read-only Stripe key (sealed). With it the webhook reads Stripe's
 * exact fee and the settled USD amount, so other currencies work too.
 */
export async function saveStripeKey(appId: string, formData: FormData) {
  const app = await requireApp(appId);
  const back = `/dashboard/${app.id}/setup`;
  const fail = (msg: string): never => redirect(`${back}?error=${encodeURIComponent(msg)}#stripe-key`);
  const secret = process.env.CRON_SECRET;
  if (!secret) fail("Stripe is not configured on this server yet");
  const key = String(formData.get("stripeKey") ?? "").trim();
  if (!STRIPE_KEY.test(key)) fail("Paste a Stripe restricted key; it starts with rk_live_ (or rk_test_ for test mode)");
  if (key.startsWith("sk_")) fail("Use a restricted key (rk_…) with read access only, not your secret key");
  const problem = await checkStripeKey(key, ["/v1/invoices", "/v1/charges", "/v1/payment_intents", "/v1/balance_transactions", "/v1/subscriptions"]);
  if (problem) fail(problem);
  await getDb().update(schema.apps).set({ stripeApiKeyCipher: await sealSecret(secret!, key) }).where(eq(schema.apps.id, app.id));
  revalidatePath(back);
  redirect(`${back}?done=${encodeURIComponent("Read-only Stripe key saved. New payments use Stripe's exact fee, in any currency your account settles in USD.")}#stripe-key`);
}

export async function removeStripeKey(appId: string) {
  const app = await requireApp(appId);
  const back = `/dashboard/${app.id}/setup`;
  await getDb().update(schema.apps).set({ stripeApiKeyCipher: null }).where(eq(schema.apps.id, app.id));
  revalidatePath(back);
  redirect(`${back}?done=${encodeURIComponent("Stripe key removed. Fees are estimated again, USD only. You can delete the key in Stripe.")}#stripe-key`);
}

/**
 * Imports the last 12 months of Stripe payments, refunds, trials and ended
 * subscriptions. The key is checked, then passed sealed to the import and
 * never stored.
 */
export async function startStripeImport(appId: string, formData: FormData) {
  const app = await requireApp(appId);
  const back = `/dashboard/${app.id}/setup`;
  const fail = (msg: string): never => redirect(`${back}?error=${encodeURIComponent(msg)}#stripe-import`);
  const secret = process.env.CRON_SECRET;
  if (!secret) fail("Stripe import is not configured on this server yet");
  // A key pasted here, or the saved read-only key.
  let key = String(formData.get("stripeKey") ?? "").trim();
  if (!key && app.stripeApiKeyCipher) key = await openSecret(secret!, app.stripeApiKeyCipher).catch(() => "");
  if (!STRIPE_KEY.test(key)) fail("Paste a Stripe restricted key; it starts with rk_live_ (or rk_test_ for test mode)");
  const problem = await checkStripeKey(key, ["/v1/invoices", "/v1/refunds", "/v1/subscriptions"]);
  if (problem) fail(problem);

  const since = Math.floor(Date.now() / 1000) - 365 * 86_400;
  await fetch(`${await origin()}/api/import/stripe/run`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ appId: app.id, keyCipher: await sealSecret(secret!, key), state: { phase: 0, since, stored: 0, skipped: 0 } }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {});
  redirect(
    `${back}?done=${encodeURIComponent("Stripe import started. Past payments appear on the dashboard over the next few minutes; you can delete the key in Stripe once they do.")}#stripe-import`,
  );
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
