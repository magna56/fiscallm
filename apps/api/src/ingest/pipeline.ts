import { hashKey, schema } from "@fiscallm/shared";
import { checkUserBudgets, deliverAlerts } from "@fiscallm/shared/alerts";
import type { MetricsDb } from "@fiscallm/shared/metrics";
import { waitUntil } from "@vercel/functions";
import { eq } from "drizzle-orm";
import type { AnyDb } from "./db";
import { type LimitBlock, noteAccepted, overMonthlyCap } from "./limit";
import { loadOverrides, loadPrices } from "./prices";
import { type IngestResult, priceEvents, storeEvents } from "./store";
import type { IngestEvent } from "./validate";

// What every ingest path shares (the SDK's /v1/events, OpenTelemetry traces,
// LiteLLM logs): find the app for a key, price the events, store them, and
// check budgets after the response.

/** The key from an Authorization header: "Bearer <key>", or the key alone (LiteLLM's config can only fill in a whole header value from the environment). */
export const bearer = (header: string | undefined) => header?.trim().match(/^(?:Bearer\s+)?(\S+)$/i)?.[1];

/** The app an ingest key belongs to. */
export async function appForKey(db: AnyDb, key: string): Promise<{ id: string } | undefined> {
  const [app] = await db
    .select({ id: schema.apps.id })
    .from(schema.apps)
    .where(eq(schema.apps.ingestKeyHash, await hashKey(key)))
    .limit(1);
  return app;
}

export const capMessage = (b: LimitBlock) =>
  `monthly event limit reached (${b.limit.toLocaleString("en-US")} events per app). It resets on ${b.resetsAt}. Self-host FiscaLLM for no limit, or open an issue if you need more.`;

export { overMonthlyCap };

export async function ingestEvents(db: AnyDb, appId: string, events: IngestEvent[]): Promise<IngestResult> {
  // Sequential on purpose: concurrent queries on one connection are
  // pipelined, which Supabase's transaction pooler cannot handle.
  const prices = await loadPrices(db);
  const overrides = await loadOverrides(db, appId);
  const rows = priceEvents(appId, events, prices, overrides);
  const result = await storeEvents(db, rows);
  noteAccepted(appId, result.accepted);
  if (result.accepted > 0) {
    // Budgets are checked after the response, so ingest stays fast.
    const userIds = [...new Set(events.map((e) => e.userId))];
    waitUntil(checkBudgets(db, appId, userIds).catch((e) => console.error("alert check failed", e)));
  }
  return result;
}

async function checkBudgets(db: AnyDb, appId: string, userIds: string[]) {
  const mdb = db as unknown as MetricsDb;
  const alerts = await checkUserBudgets(mdb, appId, userIds);
  if (alerts.length === 0) return;
  const [app] = await db
    .select({ id: schema.apps.id, name: schema.apps.name, ownerId: schema.apps.ownerId, alertSecret: schema.apps.alertSecret })
    .from(schema.apps)
    .where(eq(schema.apps.id, appId));
  if (!app) return;
  await deliverAlerts(mdb, app, alerts, { resendApiKey: process.env.RESEND_API_KEY, baseUrl: process.env.PUBLIC_URL ?? "https://fiscallm.com" });
}

/** A stable UUID for an id from another system, so a resent record is not counted twice. */
export async function stableUuid(source: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)));
  const hex = Array.from(digest.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  // Version and variant nibbles set as RFC 9562 asks (a name-based id).
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const DAY_MS = 86_400_000;
/** The same window /v1/events accepts: not in the future, not older than 90 days. */
export const tsInRange = (d: Date, now = Date.now()) =>
  !Number.isNaN(d.getTime()) && d.getTime() <= now + 3_600_000 && d.getTime() >= now - 90 * DAY_MS;

/** A provider and model as FiscaLLM's price table names them. */
export function normalizeModel(providerRaw: string | undefined, modelRaw: string): { provider: string; model: string } {
  let model = modelRaw.trim();
  let provider = (providerRaw ?? "").trim().toLowerCase();

  // "openai/gpt-4o" (gateways, LiteLLM): the prefix names the provider.
  const slash = model.indexOf("/");
  if (slash > 0 && !model.startsWith("models/")) {
    const prefix = model.slice(0, slash).toLowerCase();
    if (KNOWN_PREFIX.test(prefix) || !provider || GATEWAY.test(provider)) provider = prefix;
    model = model.slice(model.lastIndexOf("/") + 1);
  }
  // Bedrock ("us.anthropic.claude-sonnet-4-5-20250929-v1:0") and Vertex ("claude-sonnet-4-5@20250929").
  model = model
    .replace(/^(?:[a-z]{2,6}\.)?(?:anthropic|meta|amazon|mistral|cohere|ai21)\./i, "")
    .replace(/-v\d+(?::\d+)?$/i, "")
    .replace(/:\d+$/, "")
    .replace("@", "-");

  const m = model.toLowerCase();
  if (m.startsWith("claude")) provider = "anthropic";
  else if (m.startsWith("gemini")) provider = "google";
  else if (/^(gpt-|o\d|chatgpt|text-embedding|davinci|babbage|whisper|tts|dall-e|codex)/.test(m)) provider = "openai";
  else if (provider.startsWith("openai") || provider.startsWith("azure")) provider = "openai";
  else if (provider.startsWith("anthropic")) provider = "anthropic";
  else if (/^(google|gcp|gemini|vertex)/.test(provider)) provider = "google";
  return { provider: provider || "unknown", model };
}

const KNOWN_PREFIX = /^(openai|azure|anthropic|google|gemini|vertex_ai|vertex|bedrock|mistral|groq|xai|deepseek|cohere|meta|perplexity|together_ai|fireworks_ai|openrouter)$/;
const GATEWAY = /gateway|openrouter|litellm|proxy/;
