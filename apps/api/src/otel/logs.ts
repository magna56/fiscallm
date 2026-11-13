import type { IngestEvent } from "../ingest/validate";
import { LOG_SOURCES } from "../sources";
import type { OtelLog } from "./otlp";

// Turns the OpenTelemetry log events of coding agents into FiscaLLM events,
// so a team sees spend per developer. Each agent names its model-call event
// differently and counts tokens its own way, so each has a file in
// ../sources that recognises its records and maps them. A record no source
// recognises (prompts, tool calls, anything else) is not read or stored.

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
    const source = LOG_SOURCES.find((s) => s.match(l));
    if (!source) continue;
    out.calls++;
    const event = await source.toEvent(l);
    if (event === "noUser") out.noUser++;
    else if (event === "badTime") out.badTime++;
    else out.events.push({ ...event, source: source.id });
  }
  return out;
}
