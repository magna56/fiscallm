import { normalizeModel, stableUuid, tsInRange } from "../ingest/pipeline";
import type { IngestEvent } from "../ingest/validate";
import { checkWith, DAY, floorHour, getJson, HOUR, n } from "./http";
import type { PullContext, PullSource } from "./types";

// OpenAI's organization Usage API: tokens per hour, per user, API key and
// model (https://platform.openai.com/docs/api-reference/usage). Needs an
// admin key (sk-admin-…), which only an organization owner can create. The
// API gives counts, not dollars, so usage is priced from the table at list
// prices. Each row is an hour's total, so one stored event can stand for
// many requests.

const BASE = "https://api.openai.com/v1/organization";
const LAG = 2 * HOUR;
// 168 hourly buckets is the most one request returns.
const WINDOW = 7 * DAY;

type Result = Record<string, unknown> & { model?: string | null; user_id?: string | null; api_key_id?: string | null; project_id?: string | null };
interface Usage {
  data?: { start_time: number; results?: Result[] }[];
  has_more?: boolean;
  next_page?: string | null;
}
interface Users {
  data?: { id: string; email?: string | null }[];
  has_more?: boolean;
  last_id?: string | null;
}

const auth = (key: string) => ({ authorization: `Bearer ${key}` });

/** Who a row is: the member's email, else the API key, else nobody known. */
const who = (r: Result, emails: Map<string, string>) =>
  ((r.user_id && (emails.get(r.user_id) ?? r.user_id)) || (r.api_key_id && `api-key:${r.api_key_id}`) || "unattributed").slice(0, 256);

type Kind = "completions" | "embeddings" | "audio_transcriptions" | "audio_speeches";

/** The usage of one row, in the shape of an event. */
function usage(kind: Kind, r: Result): Pick<IngestEvent, "inputTokens" | "outputTokens" | "cachedTokens" | "cacheWriteTokens" | "units" | "unit"> | null {
  const none = { inputTokens: 0, outputTokens: 0, cachedTokens: 0, cacheWriteTokens: 0 };
  if (kind === "completions") {
    const cachedTokens = n(r.input_cached_tokens);
    const cacheWriteTokens = n(r.input_cache_write_tokens);
    // input_tokens includes cache reads and writes; the uncached count, when
    // it is sent, already leaves them out.
    const inputTokens = r.input_uncached_tokens !== undefined ? n(r.input_uncached_tokens) : Math.max(0, n(r.input_tokens) - cachedTokens - cacheWriteTokens);
    const outputTokens = n(r.output_tokens);
    return inputTokens + outputTokens + cachedTokens + cacheWriteTokens > 0 ? { inputTokens, outputTokens, cachedTokens, cacheWriteTokens } : null;
  }
  if (kind === "embeddings") return n(r.input_tokens) > 0 ? { ...none, inputTokens: n(r.input_tokens) } : null;
  if (kind === "audio_transcriptions") {
    const seconds = Number(r.seconds);
    return seconds > 0 ? { ...none, units: seconds / 60, unit: "minute" } : null;
  }
  return n(r.characters) > 0 ? { ...none, units: n(r.characters), unit: "character" } : null;
}

async function memberEmails(ctx: PullContext): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  let after: string | null | undefined;
  for (let i = 0; i < 50; i++) {
    const page = await getJson<Users>(ctx.fetch, "OpenAI", `${BASE}/users?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`, { headers: auth(ctx.key) });
    for (const u of page.data ?? []) if (u.email) emails.set(u.id, u.email);
    if (!page.has_more || !page.last_id) break;
    after = page.last_id;
  }
  return emails;
}

export const openai: PullSource = {
  id: "openai",
  firstDays: 30,
  check: (key, f = fetch) => checkWith(() => getJson(f, "OpenAI", `${BASE}/users?limit=1`, { headers: auth(key) })),

  async pull(ctx) {
    const until = floorHour(ctx.now.getTime() - LAG);
    let start = floorHour(ctx.since.getTime());
    if (start >= until) return false;
    const emails = await memberEmails(ctx);

    while (start < until) {
      if (Date.now() > ctx.deadline) return true;
      const end = Math.min(start + WINDOW, until);
      const events: IngestEvent[] = [];
      for (const kind of ["completions", "embeddings", "audio_transcriptions", "audio_speeches"] as const) {
        let page: string | null | undefined;
        for (let i = 0; i < 100; i++) {
          const q = new URLSearchParams({ start_time: String(start / 1000), end_time: String(end / 1000), bucket_width: "1h", limit: "168" });
          for (const g of ["user_id", "api_key_id", "model"]) q.append("group_by", g);
          if (page) q.set("page", page);
          const res = await getJson<Usage>(ctx.fetch, "OpenAI", `${BASE}/usage/${kind}?${q}`, { headers: auth(ctx.key) });
          for (const bucket of res.data ?? []) {
            const ts = new Date(bucket.start_time * 1000);
            if (!tsInRange(ts)) continue;
            for (const r of bucket.results ?? []) {
              const used = usage(kind, r);
              if (!used || !r.model) continue;
              const named = normalizeModel("openai", r.model);
              const userId = who(r, emails);
              events.push({
                id: await stableUuid(`openai:${kind}:${bucket.start_time}:${r.user_id ?? ""}:${r.api_key_id ?? ""}:${r.model}`),
                userId,
                ts,
                provider: named.provider.slice(0, 64),
                model: named.model.slice(0, 128),
                ...used,
                feature: "openai-api",
              });
            }
          }
          if (!res.has_more || !res.next_page) break;
          page = res.next_page;
        }
      }
      await ctx.store(events);
      await ctx.progress(new Date(end));
      start = end;
    }
    return false;
  },
};
