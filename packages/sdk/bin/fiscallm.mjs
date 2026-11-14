#!/usr/bin/env node
// `npx fiscallm`: what your AI coding tools cost, read from the logs they
// already keep on this machine. No account, no network, nothing is sent.
//
// Claude Code: ~/.claude/projects/**/*.jsonl (or $CLAUDE_CONFIG_DIR/projects)
// Codex CLI:   ~/.codex/sessions/**/*.jsonl (or $CODEX_HOME/sessions)

import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import { estimateCost, PRICES_CHECKED } from "../dist/prices/index.js";

const HELP = `fiscallm: what your AI coding tools cost, from their local logs

Usage: npx fiscallm [--days N] [--by day|model|project|tool] [--json]

  --days N   look back N days (default 30; 0 for everything)
  --by X     group by day, model, project or tool (default: a summary)
  --json     print rows as JSON

Reads Claude Code and Codex CLI logs on this machine. Nothing leaves it.
Costs are at API list prices (table checked ${PRICES_CHECKED}); on a Pro, Max
or ChatGPT plan you pay the subscription, so read them as what the usage
would cost on the API.

For a team view across developers and tools: https://fiscallm.com`;

function args(argv) {
  const o = { days: 30, by: "", json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") o.help = true;
    else if (a === "--json") o.json = true;
    else if (a === "--days") o.days = Number(argv[++i]);
    else if (a === "--by") o.by = argv[++i] ?? "";
    else if (a.startsWith("--days=")) o.days = Number(a.slice(7));
    else if (a.startsWith("--by=")) o.by = a.slice(5);
    else o.bad = a;
  }
  if (!Number.isFinite(o.days) || o.days < 0) o.bad = "--days";
  if (o.by && !["day", "model", "project", "tool"].includes(o.by)) o.bad = `--by ${o.by}`;
  return o;
}

function* jsonlFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* jsonlFiles(p);
    else if (e.name.endsWith(".jsonl")) yield p;
  }
}

async function* lines(file) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    try {
      yield JSON.parse(line);
    } catch {
      // A line still being written.
    }
  }
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Claude Code writes one line per content block, each with the message's usage: count each message once. */
async function claudeCode(roots, since, out) {
  const seen = new Set();
  for (const root of roots) {
    for (const file of jsonlFiles(root)) {
      if (since && statSync(file).mtimeMs < since) continue;
      for await (const d of lines(file)) {
        const m = d?.message;
        const u = m?.usage;
        if (d?.type !== "assistant" || !u || !m.model || m.model.startsWith("<")) continue;
        const at = Date.parse(d.timestamp);
        if (!(at >= since)) continue;
        const key = `${m.id}:${d.requestId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const write = num(u.cache_creation_input_tokens);
        const hour = num(u.cache_creation?.ephemeral_1h_input_tokens);
        const cached = num(u.cache_read_input_tokens);
        const input = num(u.input_tokens);
        const output = num(u.output_tokens);
        // The table's cache write price is the 5-minute one; a 1-hour write costs twice the input price.
        const e = estimateCost({ model: m.model, inputTokens: input + cached + write - hour, outputTokens: output, cachedTokens: cached, cacheWriteTokens: write - hour }, new Date(at));
        const extra = hour && e ? (hour * (estimateCost({ model: m.model, inputTokens: 1e6, outputTokens: 0 })?.costUsd ?? 0) * 2) / 1e6 : 0;
        out.push({
          tool: "Claude Code",
          at,
          model: m.model,
          project: d.cwd ? basename(d.cwd) : basename(join(file, "..")),
          tokens: input + cached + write + output,
          cost: e ? e.costUsd + extra : null,
        });
      }
    }
  }
}

/** Codex logs running totals: each token_count event's growth is one turn's usage. */
async function codex(roots, since, out) {
  for (const root of roots) {
    for (const file of jsonlFiles(root)) {
      if (since && statSync(file).mtimeMs < since) continue;
      let model = "gpt-5-codex";
      let project = "";
      let prev = null;
      for await (const d of lines(file)) {
        const p = d?.payload;
        if (!p) continue;
        if (d.type === "session_meta" || d.type === "turn_context") {
          if (typeof p.model === "string") model = p.model;
          if (typeof p.cwd === "string") project = basename(p.cwd);
          continue;
        }
        if (d.type !== "event_msg" || p.type !== "token_count" || !p.info) continue;
        const total = p.info.total_token_usage;
        let use = p.info.last_token_usage;
        if (total && prev) {
          const grew = num(total.total_tokens) - num(prev.total_tokens);
          if (grew === 0) continue; // the same totals, repeated
          if (grew > 0) use = Object.fromEntries(["input_tokens", "cached_input_tokens", "output_tokens"].map((k) => [k, num(total[k]) - num(prev[k])]));
        }
        if (total) prev = total;
        if (!use) continue;
        const at = Date.parse(d.timestamp);
        if (!(at >= since)) continue;
        const input = num(use.input_tokens);
        const output = num(use.output_tokens);
        const e = estimateCost({ model, inputTokens: input, outputTokens: output, cachedTokens: Math.min(input, num(use.cached_input_tokens)) }, new Date(at));
        out.push({ tool: "Codex", at, model, project: project || basename(file), tokens: input + output, cost: e ? e.costUsd : null });
      }
    }
  }
}

const usd = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compact = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));

function group(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = key(r);
    const g = m.get(k) ?? { name: k, calls: 0, tokens: 0, cost: 0, unpriced: 0 };
    g.calls++;
    g.tokens += r.tokens;
    if (r.cost === null) g.unpriced++;
    else g.cost += r.cost;
    m.set(k, g);
  }
  return [...m.values()];
}

const KEYS = {
  day: (r) => new Date(r.at).toISOString().slice(0, 10),
  model: (r) => r.model,
  project: (r) => `${r.project} (${r.tool})`,
  tool: (r) => r.tool,
};

function table(title, groups, limit = Infinity) {
  const shown = groups.slice(0, limit);
  const w = Math.max(title.length, ...shown.map((g) => g.name.length));
  console.log(`\n${title.padEnd(w)}  ${"calls".padStart(8)}  ${"tokens".padStart(8)}  ${"cost".padStart(11)}`);
  for (const g of shown) {
    const note = g.unpriced ? `  (${g.unpriced} unpriced)` : "";
    console.log(`${g.name.padEnd(w)}  ${String(g.calls).padStart(8)}  ${compact(g.tokens).padStart(8)}  ${usd(g.cost).padStart(11)}${note}`);
  }
  if (groups.length > shown.length) console.log(`… and ${groups.length - shown.length} more`);
}

async function main() {
  const o = args(process.argv.slice(2));
  if (o.help) return console.log(HELP);
  if (o.bad) {
    console.error(`Unknown option: ${o.bad}\n\n${HELP}`);
    process.exit(2);
  }
  const home = homedir();
  const since = o.days ? Date.now() - o.days * 86_400_000 : 0;
  const claudeRoots = [process.env.CLAUDE_CONFIG_DIR && join(process.env.CLAUDE_CONFIG_DIR, "projects"), join(home, ".claude", "projects"), join(home, ".config", "claude", "projects")];
  const codexRoots = [join(process.env.CODEX_HOME || join(home, ".codex"), "sessions")];
  const unique = (a) => [...new Set(a.filter((p) => p && existsSync(p)))];

  const rows = [];
  await claudeCode(unique(claudeRoots), since, rows);
  await codex(unique(codexRoots), since, rows);

  const byCost = (a, b) => b.cost - a.cost;
  if (o.json) {
    const out = o.by ? group(rows, KEYS[o.by]).sort(o.by === "day" ? (a, b) => a.name.localeCompare(b.name) : byCost) : rows;
    return console.log(JSON.stringify(out, null, 2));
  }
  if (!rows.length) {
    console.log(`No Claude Code or Codex usage found${o.days ? ` in the last ${o.days} days` : ""}.\nLooked in: ${[...claudeRoots, ...codexRoots].filter(Boolean).join(", ")}`);
    return;
  }
  const total = group(rows, () => "Total")[0];
  console.log(`AI coding spend${o.days ? `, last ${o.days} days` : ""}: ${usd(total.cost)} over ${total.calls.toLocaleString("en-US")} model calls (${compact(total.tokens)} tokens)`);
  if (o.by) {
    table(o.by[0].toUpperCase() + o.by.slice(1), group(rows, KEYS[o.by]).sort(o.by === "day" ? (a, b) => a.name.localeCompare(b.name) : byCost));
  } else {
    table("Tool", group(rows, KEYS.tool).sort(byCost));
    table("Model", group(rows, KEYS.model).sort(byCost), 8);
    table("Project", group(rows, KEYS.project).sort(byCost), 8);
    table("Last 7 days", group(rows.filter((r) => r.at >= Date.now() - 7 * 86_400_000), KEYS.day).sort((a, b) => a.name.localeCompare(b.name)));
  }
  console.log(`\nAt API list prices. On a subscription plan you pay the plan, not this.`);
  if (total.unpriced) console.log(`${total.unpriced} calls used models not in the price table and are not counted.`);
  console.log(`Your whole team, every AI tool, one page (free, open source): https://fiscallm.com`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
