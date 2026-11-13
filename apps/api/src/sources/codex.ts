import { normalizeModel, stableUuid, tsInRange } from "../ingest/pipeline";
import { count, named, pick, TEAM_KEYS, text, when } from "./log";
import type { LogSource } from "./types";

// OpenAI's Codex CLI, with [otel] set in ~/.codex/config.toml, emits a
// "codex.sse_event" log event for each event of a response stream. The one
// of kind "response.completed" carries the token counts of that model call
// (codex-rs/otel/src/events/session_telemetry.rs). It has no dollar figure,
// so the call is priced from the table at OpenAI's API prices. Prompts are
// off by default (log_user_prompt) and are not read either way.

// The ChatGPT account's email when signed in. With an API key there is no
// account, so the machine's host name stands in for the developer.
const USER_KEYS = ["fiscallm.user_id", "user.email", "user.account_id", "host.name"];

export const codex: LogSource = {
  id: "codex",
  // A failed completion has the same name and kind, with no token counts.
  match: (l) =>
    named(l, "codex.sse_event") &&
    text(l.attrs["event.kind"]) === "response.completed" &&
    l.attrs.input_token_count !== undefined &&
    (text(l.attrs.model) ?? text(l.attrs.slug)) !== undefined,
  async toEvent(l) {
    const userId = pick(l, USER_KEYS);
    if (!userId || userId.length > 256) return "noUser";
    const at = when(l);
    if (!at || !tsInRange(at)) return "badTime";

    // input_token_count is the whole prompt: cache reads and cache writes
    // are part of it and are priced apart. Output includes reasoning.
    const total = count(l.attrs, "input_token_count");
    const cachedTokens = count(l.attrs, "cached_token_count");
    const cacheWriteTokens = count(l.attrs, "cache_write_token_count");
    const cache = cachedTokens + cacheWriteTokens;
    const inputTokens = cache <= total ? total - cache : total;
    const outputTokens = count(l.attrs, "output_token_count");

    // The event has no ID of its own: the conversation, its time to the
    // millisecond and its counts are what a retried export repeats.
    const stamp = text(l.attrs["event.timestamp"]) ?? at.toISOString();
    const unique = `${text(l.attrs["conversation.id"]) ?? userId}:${stamp}:${total}:${outputTokens}`;
    const { provider, model } = normalizeModel("openai", (text(l.attrs.model) ?? text(l.attrs.slug))!);

    return {
      id: await stableUuid(`codex:${unique}`),
      userId,
      ts: at,
      provider: provider.slice(0, 64),
      model: model.slice(0, 128),
      inputTokens,
      outputTokens,
      cachedTokens,
      cacheWriteTokens,
      feature: (pick(l, TEAM_KEYS) ?? "codex").slice(0, 64),
    };
  },
};
