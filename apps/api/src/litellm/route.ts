import { Hono } from "hono";
import type { AnyDb } from "../ingest/db";
import { appForKey, bearer, capMessage, ingestEvents, normalizeModel, overMonthlyCap, stableUuid, tsInRange } from "../ingest/pipeline";
import type { IngestEvent } from "../ingest/validate";

// Receives LiteLLM's "generic_api" logging callback: the proxy (or the Python
// SDK) posts one StandardLoggingPayload per finished request. LiteLLM has
// already worked out the cost, so that figure is stored as is. Messages and
// responses in the payload are never read or stored.

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const CHUNK = 500;

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : typeof v === "number" ? String(v) : undefined);
const tokens = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 1e9) : 0;
};

/** JSON array (the default), one object, or newline-delimited objects. */
export function parseLogs(body: string): Json[] {
  const trimmed = body.trim();
  if (trimmed === "") return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed.map(obj) : [obj(parsed)];
  } catch {
    return trimmed
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => obj(JSON.parse(line)));
  }
}

function when(log: Json): Date | undefined {
  for (const v of [log.endTime, log.startTime]) {
    // Seconds since 1970 as a float; older versions sent an ISO string.
    const d = typeof v === "number" ? new Date(v * 1000) : typeof v === "string" ? new Date(v) : undefined;
    if (d && !Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}

export interface MappedLogs {
  events: IngestEvent[];
  failed: number;
  noUser: number;
  badTime: number;
}

export async function logsToEvents(logs: Json[]): Promise<MappedLogs> {
  const out: MappedLogs = { events: [], failed: 0, noUser: 0, badTime: 0 };
  for (const log of logs) {
    const model = str(log.model) ?? str(log.model_group);
    const id = str(log.id);
    if (!model || !id) continue;
    // A failed request costs nothing.
    if (str(log.status) && str(log.status) !== "success") {
      out.failed++;
      continue;
    }
    const meta = obj(log.metadata);
    const spendMeta = obj(meta.spend_logs_metadata);
    const requester = obj(meta.requester_metadata);
    const userId =
      str(spendMeta.fiscallm_user_id) ??
      str(requester.fiscallm_user_id) ??
      str(log.end_user) ??
      str(meta.user_api_key_end_user_id) ??
      str(meta.user_api_key_user_id);
    if (!userId || userId.length > 256) {
      out.noUser++;
      continue;
    }
    const ts = when(log);
    if (!ts || !tsInRange(ts)) {
      out.badTime++;
      continue;
    }

    // Raw provider usage: OpenAI keeps cache reads in prompt_tokens_details,
    // Anthropic in cache_read_input_tokens / cache_creation_input_tokens.
    const usage = obj(meta.usage_object);
    const cachedTokens = tokens(obj(usage.prompt_tokens_details).cached_tokens) || tokens(usage.cache_read_input_tokens);
    const cacheWriteTokens = tokens(usage.cache_creation_input_tokens);
    const prompt = tokens(log.prompt_tokens);
    const cache = cachedTokens + cacheWriteTokens;
    const responseCost = Number(log.response_cost);
    const tags = Array.isArray(log.request_tags) ? log.request_tags.map(str).filter(Boolean) : [];
    const feature =
      str(spendMeta.feature) ?? str(requester.feature) ?? tags.find((t) => t!.startsWith("feature:"))?.slice("feature:".length);
    const named = normalizeModel(str(log.custom_llm_provider) ?? str(obj(log.hidden_params).custom_llm_provider), model);

    out.events.push({
      id: await stableUuid(`litellm:${id}`),
      source: "litellm",
      userId,
      ts,
      provider: named.provider.slice(0, 64),
      model: named.model.slice(0, 128),
      inputTokens: cache <= prompt ? prompt - cache : prompt,
      outputTokens: tokens(log.completion_tokens),
      cachedTokens,
      cacheWriteTokens,
      ...(log.response_cost != null && Number.isFinite(responseCost) && responseCost >= 0 && responseCost <= 1000 ? { costUsd: responseCost } : {}),
      feature: feature?.slice(0, 64),
      jobId: (str(spendMeta.job_id) ?? str(requester.job_id))?.slice(0, 128),
    });
  }
  return out;
}

export function litellmRoute(getDb: () => AnyDb) {
  return new Hono().post("/", async (c) => {
    if (Number(c.req.header("content-length") ?? 0) > MAX_BODY_BYTES) return c.json({ error: "body too large" }, 413);
    const key = bearer(c.req.header("authorization"));
    if (!key) return c.json({ error: "missing ingest key: send Authorization: Bearer <ingest key>" }, 401);
    const db = getDb();
    const app = await appForKey(db, key);
    if (!app) return c.json({ error: "invalid ingest key" }, 401);

    let logs: Json[];
    try {
      logs = parseLogs(await c.req.text());
    } catch {
      return c.json({ error: "not JSON: send LiteLLM's generic_api log format (json_array, ndjson or single)" }, 400);
    }

    const mapped = await logsToEvents(logs);
    let accepted = 0;
    let duplicates = 0;
    if (mapped.events.length > 0) {
      const blocked = await overMonthlyCap(db, app.id);
      if (blocked) return c.json({ error: capMessage(blocked) }, 403);
      for (let i = 0; i < mapped.events.length; i += CHUNK) {
        const r = await ingestEvents(db, app.id, mapped.events.slice(i, i + CHUNK));
        accepted += r.accepted;
        duplicates += r.duplicates;
      }
    }
    return c.json({
      accepted,
      duplicates,
      skipped: { failedRequests: mapped.failed, noUser: mapped.noUser, badTime: mapped.badTime },
      ...(mapped.noUser > 0 ? { hint: 'no user id on some requests: send "user" in the request body, or set metadata.fiscallm_user_id' } : {}),
    });
  });
}
