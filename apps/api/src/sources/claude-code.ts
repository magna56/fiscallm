import { normalizeModel, stableUuid, tsInRange } from "../ingest/pipeline";
import { count, named, pick, TEAM_KEYS, text, when } from "./log";
import type { LogSource } from "./types";

// Claude Code emits one "claude_code.api_request" log event per model call
// with its token counts and its own cost estimate
// (https://code.claude.com/docs/en/monitoring-usage). Prompts are not in
// that event, and no other event is read or stored.

// Most specific first. "user.id" is Claude Code's random per-install ID, so
// it comes last: an email or account ID follows a person across machines.
const USER_KEYS = ["fiscallm.user_id", "user.email", "user.account_uuid", "user.account_id", "user.id"];

export const claudeCode: LogSource = {
  id: "claude-code",
  match: (l) => named(l, "claude_code.api_request", "api_request") && text(l.attrs.model) !== undefined,
  async toEvent(l) {
    const userId = pick(l, USER_KEYS);
    if (!userId || userId.length > 256) return "noUser";
    const at = when(l);
    if (!at || !tsInRange(at)) return "badTime";
    const stamp = text(l.attrs["event.timestamp"]);

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

    return {
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
      // What the dashboard groups by under "feature": the team, when one is
      // set with OTEL_RESOURCE_ATTRIBUTES.
      feature: (pick(l, TEAM_KEYS) ?? "claude-code").slice(0, 64),
    };
  },
};
