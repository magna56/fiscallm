import type { IngestEvent } from "../ingest/validate";
import type { OtelLog } from "../otel/otlp";

// A source is one tool FiscaLLM reads AI spend from. To add one: write a file
// here that exports a LogSource or a PullSource, add it to the list in
// index.ts, and describe it in packages/shared/src/sources.ts.

/** Why a model call could not be stored. */
export type Skip = "noUser" | "badTime";

/** A tool that exports each model call itself, as an OpenTelemetry log record. */
export interface LogSource {
  id: string;
  /** True for the log records that are one model call of this tool. */
  match(log: OtelLog): boolean;
  /** The event for a matched record, or why it cannot be stored. */
  toEvent(log: OtelLog): Promise<IngestEvent | Skip>;
}

export interface PullContext {
  /** The customer's key for the provider. */
  key: string;
  /** Usage before this is already stored. */
  since: Date;
  now: Date;
  /** Start no new request after this time (epoch ms). */
  deadline: number;
  fetch: typeof fetch;
  /** Sources of this app that sent events themselves in the last days. */
  pushing: ReadonlySet<string>;
  /** Stores events; a repeated id is ignored, so a window can be read again. */
  store(events: IngestEvent[]): Promise<void>;
  /** Records that everything before `until` is stored. */
  progress(until: Date): Promise<void>;
}

/** A provider whose usage API is read with a key of the customer's. */
export interface PullSource {
  id: string;
  /** How many days back the first sync reads. */
  firstDays: number;
  /** One cheap request with the key: what is wrong with it, or null. */
  check(key: string, f?: typeof fetch): Promise<string | null>;
  /** Reads usage from ctx.since on, window by window. True when it stopped at the deadline with more to read. */
  pull(ctx: PullContext): Promise<boolean>;
}

/** A failure with a message that is safe to show the customer. */
export class SourceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
