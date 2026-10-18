#!/usr/bin/env node
// Sends made-up AI usage and payments to a FiscaLLM app, so you can watch the
// dashboard fill in without any AI provider keys. No dependencies (Node 20+).
//
//   FISCALLM_KEY=fsk_... node examples/send-sample-data.mjs
//
// Point it at your own copy with FISCALLM_ENDPOINT=http://localhost:8787/api/v1/events.
// Use a separate test app: the sample users and payments mix into whatever app the key belongs to.
// Add --dry-run to print what would be sent.

import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const DAY = 86_400_000;

// Small seeded generator, so every run produces the same shape of data.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MODELS = [
  { provider: "openai", model: "gpt-4o-mini", input: [300, 1800], output: [80, 500] },
  { provider: "anthropic", model: "claude-sonnet-4-5", input: [400, 2500], output: [100, 900] },
  { provider: "google", model: "gemini-2.5-flash", input: [300, 2000], output: [80, 700] },
];

// requestsPerDay: [light, heavy]; the heavy user is the one that loses money.
const USERS = [
  { id: "sample_light_1", plan: "pro_monthly", requests: 2, scale: 1 },
  { id: "sample_light_2", plan: "pro_monthly", requests: 3, scale: 1 },
  { id: "sample_medium_1", plan: "pro_monthly", requests: 8, scale: 1.5 },
  { id: "sample_heavy_1", plan: "pro_monthly", requests: 60, scale: 6 },
  { id: "sample_trial_1", plan: null, trial: true, requests: 10, scale: 1.5 },
  { id: "sample_free_1", plan: null, requests: 5, scale: 1 },
];

/** Builds the made-up events and payments. `now` and `seed` make it repeatable. */
export function buildSample(now = Date.now(), seed = 1) {
  const rand = rng(seed);
  const between = ([lo, hi]) => Math.round(lo + rand() * (hi - lo));
  const events = [];
  for (const u of USERS) {
    for (let day = 13; day >= 0; day--) {
      const n = Math.max(1, Math.round(u.requests * (0.6 + rand() * 0.8)));
      for (let i = 0; i < n; i++) {
        const m = MODELS[Math.floor(rand() * MODELS.length)];
        const ts = new Date(now - day * DAY - Math.floor(rand() * 20) * 3_600_000 - 60_000);
        events.push({
          id: randomUUID(),
          userId: u.id,
          ts: ts.toISOString(),
          provider: m.provider,
          model: m.model,
          inputTokens: Math.round(between(m.input) * u.scale),
          outputTokens: Math.round(between(m.output) * u.scale),
          feature: rand() < 0.7 ? "chat" : "summary",
        });
      }
    }
  }

  const revenue = [];
  for (const u of USERS) {
    if (u.trial) {
      revenue.push({ id: `sample-${u.id}-trial`, userId: u.id, type: "trial_started", productId: "pro_monthly", ts: new Date(now - 3 * DAY).toISOString(), periodEnd: new Date(now + 4 * DAY).toISOString() });
    } else if (u.plan) {
      revenue.push({
        id: `sample-${u.id}-purchase`,
        userId: u.id,
        type: "purchase",
        productId: u.plan,
        amountUsd: 7.49,
        feePct: 0.15,
        ts: new Date(now - 10 * DAY).toISOString(),
        periodEnd: new Date(now + 20 * DAY).toISOString(),
      });
    }
  }
  return { events, revenue };
}

async function post(url, key, events) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ events }),
  });
  if (!res.ok) throw new Error(`${url} answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const key = process.env.FISCALLM_KEY;
  const endpoint = process.env.FISCALLM_ENDPOINT ?? "https://fiscallm.com/api/v1/events";
  const { events, revenue } = buildSample();
  console.log(`${events.length} usage events for ${USERS.length} sample users, ${revenue.length} payments/trials.`);
  if (dryRun) return;
  if (!key) {
    console.error("Set FISCALLM_KEY to the ingest key of a test app (shown once when you create the app).");
    process.exit(1);
  }
  for (let i = 0; i < events.length; i += 100) {
    const result = await post(endpoint, key, events.slice(i, i + 100));
    console.log(`events ${i + 1}-${Math.min(i + 100, events.length)}:`, JSON.stringify(result));
  }
  console.log("revenue:", JSON.stringify(await post(endpoint.replace(/\/events$/, "/revenue"), key, revenue)));
  console.log("Done. Open the app's dashboard: Overview, Users and Plans should now have data.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
