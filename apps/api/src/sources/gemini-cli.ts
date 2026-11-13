import { normalizeModel, stableUuid, tsInRange } from "../ingest/pipeline";
import { count, named, pick, TEAM_KEYS, text, when } from "./log";
import type { LogSource } from "./types";

// Gemini CLI, with telemetry on in ~/.gemini/settings.json, emits a
// "gemini_cli.api_response" log event per model call with its token counts
// (packages/core/src/telemetry/loggers.ts). It also emits a second record
// for the same call, "gen_ai.client.inference.operation.details", which is
// not read, so nothing is counted twice. There is no dollar figure: the call
// is priced from the table at Google's API prices.

// The Google account's email when signed in; otherwise the CLI's install ID.
const USER_KEYS = ["fiscallm.user_id", "user.email", "installation.id"];

export const geminiCli: LogSource = {
  id: "gemini-cli",
  match: (l) => named(l, "gemini_cli.api_response") && text(l.attrs.model) !== undefined,
  async toEvent(l) {
    const userId = pick(l, USER_KEYS);
    if (!userId || userId.length > 256) return "noUser";
    const at = when(l);
    if (!at || !tsInRange(at)) return "badTime";

    // input_token_count is the prompt including cached content. Tool-use
    // prompt tokens and thinking tokens are reported apart from input and
    // output, and are billed as input and output.
    const prompt = count(l.attrs, "input_token_count");
    const cachedTokens = count(l.attrs, "cached_content_token_count");
    const inputTokens = (cachedTokens <= prompt ? prompt - cachedTokens : prompt) + count(l.attrs, "tool_token_count");
    const outputTokens = count(l.attrs, "output_token_count") + count(l.attrs, "thoughts_token_count");

    // One prompt can take several model calls, so the prompt ID alone is
    // not unique: the time and the counts tell the calls apart.
    const stamp = text(l.attrs["event.timestamp"]) ?? at.toISOString();
    const unique = `${text(l.attrs["session.id"]) ?? userId}:${text(l.attrs.prompt_id) ?? ""}:${stamp}:${prompt}:${outputTokens}`;
    const { provider, model } = normalizeModel("google", text(l.attrs.model)!);

    return {
      id: await stableUuid(`gemini-cli:${unique}`),
      userId,
      ts: at,
      provider: provider.slice(0, 64),
      model: model.slice(0, 128),
      inputTokens,
      outputTokens,
      cachedTokens,
      cacheWriteTokens: 0,
      feature: (pick(l, TEAM_KEYS) ?? "gemini-cli").slice(0, 64),
    };
  },
};
