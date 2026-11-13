import type { Attrs, AttrValue, OtelLog } from "../otel/otlp";

// Helpers shared by the sources that read OpenTelemetry log records.

// Our own attribute first, so a team can name the developer and the team
// themselves on the resource, whatever the tool.
export const TEAM_KEYS = ["fiscallm.feature", "team.id", "team.name", "team", "department", "cost_center"];

export const text = (v: AttrValue | undefined) => (v === undefined || v === "" ? undefined : String(v));

/** The first of the keys that is set, on the record or on its resource. */
export const pick = (l: OtelLog, keys: string[]) => {
  for (const k of keys) {
    const v = text(l.attrs[k]) ?? text(l.resource[k]);
    if (v) return v;
  }
  return undefined;
};

export const count = (attrs: Attrs, key: string) => {
  const n = Number(attrs[key]);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 2_000_000_000) : 0;
};

/** True when the record is the named event: by event name, attribute or body. */
export const named = (l: OtelLog, ...names: string[]) => [l.name, text(l.attrs["event.name"]), l.body].some((n) => n !== undefined && names.includes(n));

/** When the call happened: the record's time, else its event.timestamp attribute. */
export function when(l: OtelLog): Date | undefined {
  if (l.at) return l.at;
  const stamp = text(l.attrs["event.timestamp"]);
  const at = stamp ? new Date(stamp) : undefined;
  return at && !Number.isNaN(at.getTime()) ? at : undefined;
}
