import { Hono } from "hono";
import type { AnyDb } from "../ingest/db";
import { appForKey, bearer, capMessage, ingestEvents, overMonthlyCap } from "../ingest/pipeline";
import { logsToEvents } from "./logs";
import { spansToEvents } from "./map";
import { type OtelLog, type OtelSpan, parseOtlpJson, parseOtlpLogsJson, parseOtlpLogsProto, parseOtlpProto, protoPartialSuccess } from "./otlp";

// OTLP/HTTP trace receiver: point an OpenTelemetry exporter at
// https://fiscallm.com/api/v1/otel (it adds /v1/traces) with the ingest key
// in the Authorization header. AI call spans become cost events; every other
// span is ignored. No FiscaLLM SDK needed. Log exports are read for the model
// calls of coding agents (Claude Code), for spend per developer.

const MAX_BODY_BYTES = 4 * 1024 * 1024;
const CHUNK = 500;

async function gunzip(buf: ArrayBuffer): Promise<ArrayBuffer> {
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
}

export function otelRoute(getDb: () => AnyDb) {
  const route = new Hono();

  route.post("/v1/traces", async (c) => {
    if (Number(c.req.header("content-length") ?? 0) > MAX_BODY_BYTES) return c.json({ error: "body too large" }, 413);
    const key = bearer(c.req.header("authorization"));
    if (!key) return c.json({ error: "missing ingest key: send Authorization: Bearer <ingest key>" }, 401);
    const db = getDb();
    const app = await appForKey(db, key);
    if (!app) return c.json({ error: "invalid ingest key" }, 401);

    const proto = /protobuf/i.test(c.req.header("content-type") ?? "");
    let spans: OtelSpan[];
    try {
      let raw = await c.req.arrayBuffer();
      if (/gzip/i.test(c.req.header("content-encoding") ?? "")) raw = await gunzip(raw);
      spans = proto ? parseOtlpProto(new Uint8Array(raw)) : parseOtlpJson(JSON.parse(new TextDecoder().decode(raw)));
    } catch {
      return c.json({ error: "not an OTLP trace export (send JSON or protobuf to /v1/traces)" }, 400);
    }

    const mapped = await spansToEvents(spans);
    if (mapped.events.length > 0) {
      const blocked = await overMonthlyCap(db, app.id);
      if (blocked) return c.json({ error: capMessage(blocked) }, 403);
      for (let i = 0; i < mapped.events.length; i += CHUNK) {
        await ingestEvents(db, app.id, mapped.events.slice(i, i + CHUNK));
      }
    }

    const rejected = mapped.noUser + mapped.badTime;
    if (rejected === 0) {
      return proto ? c.body(new Uint8Array(0), 200, { "content-type": "application/x-protobuf" }) : c.json({});
    }
    const why = [
      mapped.noUser > 0
        ? `${mapped.noUser} AI call span(s) had no user id: set the "user.id" attribute on the span, a parent span or the resource`
        : "",
      mapped.badTime > 0 ? `${mapped.badTime} AI call span(s) were older than 90 days or dated in the future` : "",
    ]
      .filter(Boolean)
      .join("; ");
    return proto
      ? c.body(protoPartialSuccess(rejected, why) as Uint8Array<ArrayBuffer>, 200, { "content-type": "application/x-protobuf" })
      : c.json({ partialSuccess: { rejectedSpans: rejected, errorMessage: why } });
  });

  // Claude Code reports each model call as a log event. Other log records
  // are ignored.
  route.post("/v1/logs", async (c) => {
    if (Number(c.req.header("content-length") ?? 0) > MAX_BODY_BYTES) return c.json({ error: "body too large" }, 413);
    const key = bearer(c.req.header("authorization"));
    if (!key) return c.json({ error: "missing ingest key: send Authorization: Bearer <ingest key>" }, 401);
    const db = getDb();
    const app = await appForKey(db, key);
    if (!app) return c.json({ error: "invalid ingest key" }, 401);

    const proto = /protobuf/i.test(c.req.header("content-type") ?? "");
    let logs: OtelLog[];
    try {
      let raw = await c.req.arrayBuffer();
      if (/gzip/i.test(c.req.header("content-encoding") ?? "")) raw = await gunzip(raw);
      logs = proto ? parseOtlpLogsProto(new Uint8Array(raw)) : parseOtlpLogsJson(JSON.parse(new TextDecoder().decode(raw)));
    } catch {
      return c.json({ error: "not an OTLP logs export (send JSON or protobuf to /v1/logs)" }, 400);
    }

    const mapped = await logsToEvents(logs);
    if (mapped.events.length > 0) {
      const blocked = await overMonthlyCap(db, app.id);
      if (blocked) return c.json({ error: capMessage(blocked) }, 403);
      for (let i = 0; i < mapped.events.length; i += CHUNK) {
        await ingestEvents(db, app.id, mapped.events.slice(i, i + CHUNK));
      }
    }

    const rejected = mapped.noUser + mapped.badTime;
    if (rejected === 0) {
      return proto ? c.body(new Uint8Array(0), 200, { "content-type": "application/x-protobuf" }) : c.json({});
    }
    const why = [
      mapped.noUser > 0 ? `${mapped.noUser} model call event(s) had no user: sign in to Claude Code, or set fiscallm.user_id in OTEL_RESOURCE_ATTRIBUTES` : "",
      mapped.badTime > 0 ? `${mapped.badTime} model call event(s) were older than 90 days or dated in the future` : "",
    ]
      .filter(Boolean)
      .join("; ");
    return proto
      ? c.body(protoPartialSuccess(rejected, why) as Uint8Array<ArrayBuffer>, 200, { "content-type": "application/x-protobuf" })
      : c.json({ partialSuccess: { rejectedLogRecords: rejected, errorMessage: why } });
  });

  // An exporter set up with one endpoint for everything also posts metrics
  // here. Accept and drop them, so it does not log errors.
  route.post("/v1/metrics", (c) => c.json({}));

  return route;
}
