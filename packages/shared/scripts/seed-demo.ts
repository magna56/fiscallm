// Creates a "Demo" app with 60 days of realistic made-up data, sent through
// the live ingest API and RevenueCat webhook like a real customer's.
// Usage: pnpm seed-demo <owner user id> [base url]
import { existsSync } from "node:fs";
import { createDb } from "../src/db";
import { generateIngestKey, generateWebhookSecret, hashKey } from "../src/keys";
import { apps } from "../src/schema";

if (existsSync(".env")) process.loadEnvFile(".env");
const [ownerId, base = "https://fiscallm.com"] = process.argv.slice(2);
if (!ownerId) throw new Error("Usage: pnpm seed-demo <owner user id> [base url]");

// Deterministic, so reruns give the same picture.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
const between = (a: number, b: number) => a + rand() * (b - a);

const DAY = 86_400_000;
const now = Date.now();
const DAYS = 60;
const PLANS = {
  pro_monthly: { price: 9.99, period: 30 },
  pro_yearly: { price: 59.99, period: 365 },
};

type Kind = "free" | "trial_lost" | "trial_won" | "monthly" | "yearly" | "power";
const KINDS: [Kind, number][] = [
  ["free", 0.42],
  ["trial_lost", 0.16],
  ["trial_won", 0.1],
  ["monthly", 0.18],
  ["yearly", 0.1],
  ["power", 0.04],
];
const kindOf = () => {
  let r = rand();
  for (const [k, p] of KINDS) if ((r -= p) < 0) return k;
  return "free";
};

// Requests per active day and how heavy each is.
const USAGE: Record<Kind, { active: number; perDay: [number, number]; heavy: number }> = {
  free: { active: 0.25, perDay: [1, 4], heavy: 0.3 },
  trial_lost: { active: 0.7, perDay: [3, 12], heavy: 1 },
  trial_won: { active: 0.8, perDay: [4, 15], heavy: 1 },
  monthly: { active: 0.6, perDay: [3, 14], heavy: 1 },
  yearly: { active: 0.55, perDay: [2, 10], heavy: 1 },
  power: { active: 0.95, perDay: [40, 120], heavy: 2.5 },
};

interface Ev {
  id: string;
  userId: string;
  ts: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  costUsd?: number;
  feature: string;
}

function request(userId: string, t: number, heavy: number, kind: Kind): Ev {
  const ts = new Date(t).toISOString();
  const id = crypto.randomUUID();
  const r = rand();
  if (r < 0.04 && kind !== "free") {
    return { id, userId, ts, provider: "fal", model: "flux-pro", inputTokens: 0, outputTokens: 0, costUsd: 0.05, feature: "image" };
  }
  if (r < 0.3) {
    const input = Math.round(between(4000, 20000) * heavy);
    return { id, userId, ts, provider: "openai", model: "gpt-5-mini", inputTokens: input, outputTokens: Math.round(between(200, 600)), feature: "summary" };
  }
  if (kind === "free" || r < 0.6) {
    return { id, userId, ts, provider: "google", model: "gemini-3.8-flash", inputTokens: Math.round(between(1500, 6000) * heavy), outputTokens: Math.round(between(300, 1200) * heavy), feature: "chat" };
  }
  const input = Math.round(between(3000, 12000) * heavy);
  return {
    id, userId, ts, provider: "anthropic", model: "claude-sonnet-5-5",
    inputTokens: input, cachedTokens: Math.round(input * between(1, 4)), outputTokens: Math.round(between(400, 1500) * heavy), feature: "chat",
  };
}

const db = createDb(process.env.DATABASE_URL!);
const key = generateIngestKey();
const secret = generateWebhookSecret();
const [app] = await db
  .insert(apps)
  .values({ name: "Demo", ownerId, ingestKeyHash: await hashKey(key), rcWebhookSecret: secret })
  .returning({ id: apps.id });
const appId = app!.id;
console.log(`Demo app ${appId}`);

const events: Ev[] = [];
const webhooks: Record<string, unknown>[] = [];
let n = 0;
const rc = (userId: string, type: string, at: number, o: Record<string, unknown>) => {
  const store = pick(["APP_STORE", "APP_STORE", "PLAY_STORE"]);
  webhooks.push({
    id: `demo_${++n}`, type, app_user_id: userId, original_app_user_id: userId, aliases: [userId],
    environment: "PRODUCTION", store, event_timestamp_ms: Math.round(at), purchased_at_ms: Math.round(at),
    tax_percentage: pick([0, 0, 0.08, 0.17, 0.2]), commission_percentage: 0.15, ...o,
  });
};

for (let u = 0; u < 220; u++) {
  const userId = `user_${(1000 + u).toString(36)}${Math.floor(rand() * 1e6).toString(36)}`;
  const kind = kindOf();
  const start = now - Math.floor(between(1, DAYS)) * DAY;
  const usage = USAGE[kind];

  // Subscription history.
  if (kind === "trial_lost" || kind === "trial_won" || kind === "monthly" || kind === "power") {
    const trial = kind.startsWith("trial") || rand() < 0.6;
    let t = start;
    if (trial) {
      rc(userId, "INITIAL_PURCHASE", t, { product_id: "pro_monthly", period_type: "TRIAL", price: 0, expiration_at_ms: t + 7 * DAY });
      t += 7 * DAY;
      if (kind === "trial_lost") {
        rc(userId, "CANCELLATION", start + 5 * DAY, { product_id: "pro_monthly", price: 0, cancel_reason: "UNSUBSCRIBE" });
        if (t < now) rc(userId, "EXPIRATION", t, { product_id: "pro_monthly", expiration_at_ms: t });
      } else if (t < now) {
        rc(userId, "RENEWAL", t, { product_id: "pro_monthly", period_type: "NORMAL", price: PLANS.pro_monthly.price, is_trial_conversion: true, expiration_at_ms: t + 30 * DAY });
        t += 30 * DAY;
      }
    } else {
      rc(userId, "INITIAL_PURCHASE", t, { product_id: "pro_monthly", period_type: "NORMAL", price: PLANS.pro_monthly.price, expiration_at_ms: t + 30 * DAY });
      t += 30 * DAY;
    }
    if (kind !== "trial_lost") {
      while (t < now) {
        rc(userId, "RENEWAL", t, { product_id: "pro_monthly", period_type: "NORMAL", price: PLANS.pro_monthly.price, expiration_at_ms: t + 30 * DAY });
        t += 30 * DAY;
      }
    }
  } else if (kind === "yearly") {
    rc(userId, "INITIAL_PURCHASE", start, { product_id: "pro_yearly", period_type: "NORMAL", price: PLANS.pro_yearly.price, expiration_at_ms: start + 365 * DAY });
  }

  // AI usage, heavier while on trial.
  for (let d = start; d < now; d += DAY) {
    if (rand() > usage.active) continue;
    const onTrial = (kind === "trial_lost" || kind === "trial_won") && d < start + 7 * DAY;
    if (kind === "trial_lost" && d > start + 7 * DAY) break;
    const count = Math.round(between(...usage.perDay) * (onTrial ? 1.5 : 1));
    for (let i = 0; i < count; i++) events.push(request(userId, Math.min(d + between(0, DAY), now - 60_000), usage.heavy, kind));
  }
}

console.log(`${events.length} AI events, ${webhooks.length} webhooks`);

for (let i = 0; i < events.length; i += 100) {
  const res = await fetch(`${base}/api/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ events: events.slice(i, i + 100) }),
  });
  if (res.status !== 202) throw new Error(`ingest ${res.status}: ${await res.text()}`);
}
console.log("AI events sent");

webhooks.sort((a, b) => (a.event_timestamp_ms as number) - (b.event_timestamp_ms as number));
for (const event of webhooks) {
  const res = await fetch(`${base}/api/webhooks/rc/${appId}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: secret },
    body: JSON.stringify({ api_version: "1.0", event }),
  });
  if (res.status !== 200) throw new Error(`webhook ${res.status}: ${await res.text()}`);
}
console.log("Webhooks sent");
console.log(`Open ${base}/dashboard/${appId}`);
await db.$client.end();
