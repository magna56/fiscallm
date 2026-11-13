import { normalizeModel, stableUuid, tsInRange } from "../ingest/pipeline";
import type { IngestEvent } from "../ingest/validate";
import { checkWith, DAY, floorHour, getJson, n } from "./http";
import { type PullContext, type PullSource, SourceError } from "./types";

// Anthropic's usage analytics API: tokens per hour, per member or API key,
// model and product (https://docs.claude.com/en/api/usage-cost-api). Needs
// an Admin API key (sk-ant-admin…) of a Claude Console organization; it is
// not available to individual accounts or the claude.ai Team plan. The data
// is refreshed every few hours: rows after its `data_refreshed_at` are left
// for the next sync. Counts, not dollars: priced from the table.

const URL_BASE = "https://api.anthropic.com/v1/organizations/analytics/usage";
const BETA = "analytics-usage-cost-2026-08-24";
const WINDOW = 7 * DAY;

type Actor =
  | { type: "user_actor"; email_address?: string | null; user_id?: string }
  | { type: "api_actor"; api_key_id?: string }
  | { type: "service_account_actor"; service_account_id?: string }
  | { type: "federated_actor"; subject?: string }
  | null;
interface Row {
  starting_at: string;
  ending_at: string;
  group?: { actor?: Actor; model?: string | null; product?: string | null };
  usage?: {
    uncached_input_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation?: { ephemeral_1h_input_tokens?: number; ephemeral_5m_input_tokens?: number };
    output_tokens?: number;
  };
}
interface Usage {
  data?: Row[];
  has_more?: boolean;
  next_page?: string | null;
  data_refreshed_at?: string;
}

const versions = { "anthropic-version": "2023-06-01", "anthropic-beta": BETA };

/** The guide sends the admin key as x-api-key; the reference shows a bearer token. Both are tried. */
async function get(f: typeof fetch, key: string, url: string): Promise<Usage> {
  try {
    return await getJson<Usage>(f, "Anthropic", url, { headers: { ...versions, "x-api-key": key } });
  } catch (e) {
    if (!(e instanceof SourceError) || e.status !== 401) throw e;
    return getJson<Usage>(f, "Anthropic", url, { headers: { ...versions, authorization: `Bearer ${key}` } });
  }
}

const who = (a: Actor | undefined): string => {
  if (!a) return "unattributed";
  if (a.type === "user_actor") return a.email_address || a.user_id || "unattributed";
  if (a.type === "api_actor") return a.api_key_id ? `api-key:${a.api_key_id}` : "unattributed";
  if (a.type === "service_account_actor") return a.service_account_id ? `service:${a.service_account_id}` : "unattributed";
  return a.subject || "unattributed";
};

function query(from: number, to: number, page?: string) {
  const q = new URLSearchParams({ starting_at: new Date(from).toISOString(), ending_at: new Date(to).toISOString(), time_bucket_width: "1h", limit: "1000" });
  for (const g of ["actor", "model", "product"]) q.append("group_by[]", g);
  if (page) q.set("page", page);
  return `${URL_BASE}?${q}`;
}

async function readWindow(ctx: PullContext, from: number, to: number): Promise<{ rows: Row[]; refreshed: number } | "deadline"> {
  // A page cursor can expire (HTTP 410); the window is then read again.
  for (let attempt = 0; ; attempt++) {
    const rows: Row[] = [];
    let refreshed = Infinity;
    let page: string | undefined;
    try {
      for (let i = 0; i < 200; i++) {
        if (Date.now() > ctx.deadline) return "deadline";
        const res = await get(ctx.fetch, ctx.key, query(from, to, page));
        rows.push(...(res.data ?? []));
        const at = res.data_refreshed_at ? new Date(res.data_refreshed_at).getTime() : NaN;
        if (Number.isFinite(at)) refreshed = Math.min(refreshed, at);
        if (!res.has_more || !res.next_page) break;
        page = res.next_page;
      }
      return { rows, refreshed };
    } catch (e) {
      if (attempt === 0 && e instanceof SourceError && e.status === 410) continue;
      throw e;
    }
  }
}

export const anthropic: PullSource = {
  id: "anthropic",
  firstDays: 30,
  check: (key, f = fetch) => {
    const now = floorHour(Date.now());
    return checkWith(() => get(f, key, query(now - DAY, now)));
  },

  async pull(ctx) {
    const until = floorHour(ctx.now.getTime());
    let start = floorHour(ctx.since.getTime());
    while (start < until) {
      if (Date.now() > ctx.deadline) return true;
      const end = Math.min(start + WINDOW, until);
      const read = await readWindow(ctx, start, end);
      if (read === "deadline") return true;
      // Rows the refresh has not fully covered yet are read next time.
      const done = Math.min(end, floorHour(read.refreshed));
      const events: IngestEvent[] = [];
      for (const r of read.rows) {
        const ts = new Date(r.starting_at);
        const product = r.group?.product ?? "api";
        // Claude Code sending its own export has every call, with the cost
        // it computed; reading it here too would count it twice.
        if (product === "claude_code" && ctx.pushing.has("claude-code")) continue;
        if (new Date(r.ending_at).getTime() > done || !tsInRange(ts) || !r.group?.model) continue;
        const u = r.usage ?? {};
        const used = {
          inputTokens: n(u.uncached_input_tokens),
          outputTokens: n(u.output_tokens),
          cachedTokens: n(u.cache_read_input_tokens),
          cacheWriteTokens: n(u.cache_creation?.ephemeral_1h_input_tokens) + n(u.cache_creation?.ephemeral_5m_input_tokens),
        };
        if (used.inputTokens + used.outputTokens + used.cachedTokens + used.cacheWriteTokens === 0) continue;
        const userId = who(r.group.actor).slice(0, 256);
        const named = normalizeModel("anthropic", r.group.model);
        events.push({
          id: await stableUuid(`anthropic:${r.starting_at}:${userId}:${r.group.model}:${product}`),
          userId,
          ts,
          provider: named.provider.slice(0, 64),
          model: named.model.slice(0, 128),
          ...used,
          feature: product.slice(0, 64),
        });
      }
      await ctx.store(events);
      if (done <= start) return false;
      await ctx.progress(new Date(done));
      if (done < end) return false;
      start = end;
    }
    return false;
  },
};
