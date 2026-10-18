#!/usr/bin/env node
// Sends made-up AI usage and payments to a FiscaLLM app, so you can watch the
// dashboard fill in without any AI provider keys. No dependencies (Node 20+).
//
//   FISCALLM_KEY=fsk_... node examples/send-sample-data.mjs [options]
//
// Point it at your own copy with FISCALLM_ENDPOINT=http://localhost:8787/api/v1/events.
// Use a separate test app: the sample users and payments mix into whatever app the key belongs to.
// Run with --help to see the available options.

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
export function buildSample(now = Date.now(), seed = 1, { users = USERS.length, days = 14 } = {}) {
  const rand = rng(seed);
  const between = ([lo, hi]) => Math.round(lo + rand() * (hi - lo));
  const sampleUsers = Array.from({ length: users }, (_, i) => {
    const base = USERS[i % USERS.length];
    const generation = Math.floor(i / USERS.length);
    return generation === 0 ? base : { ...base, id: `${base.id}_extra${generation}` };
  });
  const events = [];
  for (const u of sampleUsers) {
    for (let day = days - 1; day >= 0; day--) {
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
  for (const u of sampleUsers) {
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

const HELP = `Usage: FISCALLM_KEY=fsk_... node examples/send-sample-data.mjs [options]

Send made-up usage and payment data to a FiscaLLM test app.

Options:
  --help       Show this help
  --dry-run    Print the data summary without sending anything
  --users N    Number of sample users (default: 6)
  --days N     Days of usage history (default: 14, maximum: 90)
  --seed N     Seed for repeatable sample values (default: 1)`;

export function parseOptions(argv) {
  const options = { help: false, dryRun: false, users: USERS.length, days: 14, seed: 1 };
  const valueOptions = new Set(["--users", "--days", "--seed"]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else {
      const [name, inlineValue] = arg.split(/=(.*)/s, 2);
      if (!valueOptions.has(name)) throw new Error(`Unknown option: ${name}`);
      const raw = inlineValue ?? argv[++i];
      if (raw === undefined || raw.startsWith("--")) throw new Error(`${name} needs a value`);
      if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a whole number`);
      const value = Number(raw);
      if (!Number.isSafeInteger(value)) throw new Error(`${name} must be a safe whole number`);
      if (name === "--users" || name === "--days") {
        if (value < 1) throw new Error(`${name} must be 1 or more`);
      } else if (value < 0) throw new Error(`${name} must be 0 or more`);
      if (name === "--days" && value > 90) throw new Error("--days cannot be more than 90 (the API rejects older events)");
      options[name.slice(2)] = value;
    }
  }
  return options;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);
  if (options.help) {
    console.log(HELP);
    return;
  }
  const key = process.env.FISCALLM_KEY;
  const endpoint = process.env.FISCALLM_ENDPOINT ?? "https://fiscallm.com/api/v1/events";
  const { events, revenue } = buildSample(Date.now(), options.seed, { users: options.users, days: options.days });
  console.log(`${events.length} usage events for ${options.users} sample users across ${options.days} days, ${revenue.length} payments/trials.`);
  if (options.dryRun) return;
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
