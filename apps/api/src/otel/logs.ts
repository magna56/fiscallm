import { normalizeModel, stableUuid, tsInRange } from "../ingest/pipeline";
import type { IngestEvent } from "../ingest/validate";
import type { Attrs, AttrValue, OtelLog } from "./otlp";

// Turns the OpenTelemetry log events of coding agents into FiscaLLM events,
// so a team sees spend per developer. Today that is Claude Code, which emits
// one "claude_code.api_request" event per model call with its token counts
// and its own cost estimate
// (https://code.claude.com/docs/en/monitoring-usage). Prompts are not in
// that event, and no other event is read or stored.

// Most specific first. "user.id" is Claude Code's random per-install ID, so
// it comes last: an email or account ID follows a person across machines.
const USER_KEYS = ["fiscallm.user_id", "user.email", "user.account_uuid", "user.account_id", "user.id"];
// What the dashboard groups by under "feature": the team, when one is set
// with OTEL_RESOURCE_ATTRIBUTES.
const TEAM_KEYS = ["fiscallm.feature", "team.id", "team.name", "team", "department", "cost_center"];

const text = (v: AttrValue | undefined) => (v === undefined || v === "" ? undefined : String(v));
const pick = (l: OtelLog, keys: string[]) => {
  for (const k of keys) {
    const v = text(l.attrs[k]) ?? text(l.resource[k]);
    if (v) return v;
  }
  return undefined;
};
/** A token count. Claude Code sends event attributes as strings. */
const count = (attrs: Attrs, key: string) => {
  const n = Number(attrs[key]);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 2_000_000_000) : 0;
};

function isApiRequest(l: OtelLog): boolean {
  const names = [l.name, text(l.attrs["event.name"]), l.body];
  return names.some((n) => n === "claude_code.api_request" || n === "api_request") && text(l.attrs.model) !== undefined;
}

export interface MappedLogs {
  events: IngestEvent[];
  /** Log records that are model calls, whether or not they could be stored. */
  calls: number;
  noUser: number;
  badTime: number;
}

export async function logsToEvents(logs: OtelLog[]): Promise<MappedLogs> {
  const out: MappedLogs = { events: [], calls: 0, noUser: 0, badTime: 0 };
  for (const l of logs) {
    if (!isApiRequest(l)) continue;
    out.calls++;
    const userId = pick(l, USER_KEYS);
    if (!userId || userId.length > 256) {
      out.noUser++;
      continue;
    }
    const stamp = text(l.attrs["event.timestamp"]);
    const at = l.at ?? (stamp ? new Date(stamp) : undefined);
    if (!at || !tsInRange(at)) {
      out.badTime++;
      continue;
    }

    // The provider's request ID when there is one; otherwise the session
    // and the event's own time and counter, which a retried export repeats.
    const unique =
      text(l.attrs.request_id) ??
      text(l.attrs.client_request_id) ??
      `${pick(l, ["session.id"]) ?? userId}:${stamp ?? at.toISOString()}:${text(l.attrs["event.sequence"]) ?? ""}`;
    const { provider, model } = normalizeModel("anthropic", text(l.attrs.model)!);
    // cost_usd is the full figure; cost_usd_micros is the same, rounded.
    const usd = l.attrs.cost_usd === undefined ? NaN : Number(l.attrs.cost_usd);
    const cost = Number.isFinite(usd) ? usd : l.attrs.cost_usd_micros === undefined ? NaN : Number(l.attrs.cost_usd_micros) / 1_000_000;
    const hasCost = Number.isFinite(cost) && cost >= 0 && cost <= 1000;

    out.events.push({
      id: await stableUuid(`claude-code:${unique}`),
      userId,
      ts: at,
      provider: provider.slice(0, 64),
      model: model.slice(0, 128),
      inputTokens: count(l.attrs, "input_tokens"),
      outputTokens: count(l.attrs, "output_tokens"),
      cachedTokens: count(l.attrs, "cache_read_tokens"),
      cacheWriteTokens: count(l.attrs, "cache_creation_tokens"),
      // Claude Code's own figure knows about fast mode and cache lifetimes.
      ...(hasCost ? { costUsd: cost } : {}),
      feature: (pick(l, TEAM_KEYS) ?? "claude-code").slice(0, 64),
    });
  }
  return out;
}
