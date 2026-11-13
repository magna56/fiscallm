import { normalizeModel, stableUuid, tsInRange } from "../ingest/pipeline";
import type { IngestEvent } from "../ingest/validate";
import { checkWith, DAY, floorHour, getJson, HOUR, n } from "./http";
import type { PullSource } from "./types";

// Cursor's Admin API lists each usage event of a team with the developer's
// email, the model, the tokens and what it cost
// (https://cursor.com/docs/account/teams/admin-api). Needs a team admin's
// API key. Cursor's data is about an hour behind, so the last two hours are
// left for the next sync.

const BASE = "https://api.cursor.com";
const LAG = 2 * HOUR;
const PAGE = 1000;
// A window with more events than this is split in two, so one window's
// pages fit in one sync.
const MAX_EVENTS = 10_000;
const MAX_WINDOW = 7 * DAY;

interface UsageEvent {
  timestamp?: string | number;
  userEmail?: string;
  model?: string;
  kind?: string;
  isTokenBasedCall?: boolean;
  chargedCents?: number;
  tokenUsage?: { inputTokens?: number; outputTokens?: number; cacheWriteTokens?: number; cacheReadTokens?: number; totalCents?: number };
}
interface Page {
  totalUsageEventsCount?: number;
  pagination?: { numPages?: number; hasNextPage?: boolean };
  usageEvents?: UsageEvent[];
}

const auth = (key: string) => ({ authorization: `Basic ${btoa(`${key}:`)}`, "content-type": "application/json" });

async function toEvent(u: UsageEvent): Promise<IngestEvent | null> {
  const ts = new Date(Number(u.timestamp));
  if (!tsInRange(ts)) return null;
  const t = u.tokenUsage ?? {};
  // What the team was charged when the call was billed; otherwise (calls
  // included in the plan) what the model cost Cursor, as the closest figure
  // to what that usage is worth.
  const cents = n(u.chargedCents) > 0 ? Number(u.chargedCents) : Number(t.totalCents ?? 0);
  const raw = u.model?.trim() || "unknown";
  const named = normalizeModel(undefined, raw);
  const userId = (u.userEmail?.trim() || "unattributed").slice(0, 256);
  const counts = [n(t.inputTokens), n(t.outputTokens), n(t.cacheReadTokens), n(t.cacheWriteTokens)];
  return {
    id: await stableUuid(`cursor:${u.timestamp}:${userId}:${raw}:${counts.join(":")}:${u.chargedCents ?? ""}`),
    userId,
    ts,
    provider: (named.provider === "unknown" ? "cursor" : named.provider).slice(0, 64),
    model: named.model.slice(0, 128),
    inputTokens: counts[0]!,
    outputTokens: counts[1]!,
    cachedTokens: counts[2]!,
    cacheWriteTokens: counts[3]!,
    ...(Number.isFinite(cents) && cents >= 0 ? { costUsd: Math.min(cents / 100, 1000) } : {}),
    feature: "cursor",
  };
}

export const cursor: PullSource = {
  id: "cursor",
  firstDays: 30,
  check: (key, f = fetch) => checkWith(() => getJson(f, "Cursor", `${BASE}/teams/members`, { headers: auth(key) })),

  async pull(ctx) {
    const until = floorHour(ctx.now.getTime() - LAG);
    let start = ctx.since.getTime();
    let window = MAX_WINDOW;
    const page = (from: number, to: number, no: number) =>
      getJson<Page>(ctx.fetch, "Cursor", `${BASE}/teams/filtered-usage-events`, {
        method: "POST",
        headers: auth(ctx.key),
        body: JSON.stringify({ startDate: from, endDate: to, page: no, pageSize: PAGE }),
      });

    while (start < until) {
      if (Date.now() > ctx.deadline) return true;
      const end = Math.min(start + window, until);
      const first = await page(start, end, 1);
      const total = first.totalUsageEventsCount ?? first.usageEvents?.length ?? 0;
      if (total > MAX_EVENTS && window > HOUR) {
        window = Math.max(HOUR, floorHour(window / 2));
        continue;
      }
      // The order of events across pages is not documented, so a window
      // counts as read only when all its pages are.
      const events: UsageEvent[] = [...(first.usageEvents ?? [])];
      let more = first.pagination?.hasNextPage ?? false;
      for (let no = 2; more; no++) {
        if (Date.now() > ctx.deadline) return true;
        const next = await page(start, end, no);
        events.push(...(next.usageEvents ?? []));
        more = (next.pagination?.hasNextPage ?? false) && (next.usageEvents?.length ?? 0) > 0;
      }
      const mapped = (await Promise.all(events.map(toEvent))).filter((e): e is IngestEvent => e !== null);
      await ctx.store(mapped);
      await ctx.progress(new Date(end));
      start = end;
      if (total < MAX_EVENTS / 4) window = Math.min(window * 2, MAX_WINDOW);
    }
    return false;
  },
};
