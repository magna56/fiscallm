// Reads an OTLP trace export (ExportTraceServiceRequest) in either encoding
// the OTLP/HTTP spec allows: JSON, or binary protobuf. Only what cost tracking
// needs is kept: ids, name, end time and scalar attributes.

export type AttrValue = string | number | boolean;
export type Attrs = Record<string, AttrValue>;

export interface OtelSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  /** End of the span, or its start when no end was recorded. */
  at: Date;
  attrs: Attrs;
  /** Attributes of the resource (the service) that produced the span. */
  resource: Attrs;
}

// ---- JSON ----

type Json = Record<string, unknown>;
const list = (v: unknown): Json[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Json[]) : []);

function jsonValue(v: unknown): AttrValue | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Json;
  if (typeof o.stringValue === "string") return o.stringValue;
  if (typeof o.boolValue === "boolean") return o.boolValue;
  // int64 is a string in OTLP/JSON; some exporters send a number.
  if (o.intValue !== undefined) {
    const n = Number(o.intValue);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof o.doubleValue === "number") return o.doubleValue;
  return undefined;
}

function jsonAttrs(v: unknown): Attrs {
  const out: Attrs = {};
  for (const kv of list(v)) {
    const value = jsonValue(kv.value);
    if (typeof kv.key === "string" && value !== undefined) out[kv.key] = value;
  }
  return out;
}

function nanosToDate(v: unknown): Date | undefined {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  try {
    const ms = Number(BigInt(v) / 1_000_000n);
    return ms > 0 ? new Date(ms) : undefined;
  } catch {
    return undefined;
  }
}

const hexId = (v: unknown) => (typeof v === "string" && /^[0-9a-f]+$/i.test(v) && !/^0+$/.test(v) ? v.toLowerCase() : undefined);

export function parseOtlpJson(body: unknown): OtelSpan[] {
  const spans: OtelSpan[] = [];
  for (const rs of list((body as Json | null)?.resourceSpans)) {
    const resource = jsonAttrs((rs.resource as Json | undefined)?.attributes);
    for (const ss of list(rs.scopeSpans)) {
      for (const s of list(ss.spans)) {
        const traceId = hexId(s.traceId);
        const spanId = hexId(s.spanId);
        const at = nanosToDate(s.endTimeUnixNano) ?? nanosToDate(s.startTimeUnixNano);
        if (!traceId || !spanId || !at) continue;
        spans.push({
          traceId,
          spanId,
          parentSpanId: hexId(s.parentSpanId),
          name: typeof s.name === "string" ? s.name : "",
          at,
          attrs: jsonAttrs(s.attributes),
          resource,
        });
      }
    }
  }
  return spans;
}

// ---- Protobuf ----
// A small wire-format reader, so the API needs no protobuf dependency.
// Field numbers are from opentelemetry-proto (trace/v1/trace.proto).

type Field = { no: number; wire: number; int: bigint; bytes: Uint8Array };

function* fields(buf: Uint8Array): Generator<Field> {
  let pos = 0;
  const varint = () => {
    let result = 0n;
    for (let shift = 0n; ; shift += 7n) {
      if (pos >= buf.length || shift > 63n) throw new Error("bad varint");
      const b = buf[pos++]!;
      result |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) return result;
    }
  };
  const take = (n: number) => {
    if (n < 0 || pos + n > buf.length) throw new Error("truncated message");
    const slice = buf.subarray(pos, pos + n);
    pos += n;
    return slice;
  };
  const none = new Uint8Array(0);
  while (pos < buf.length) {
    const tag = varint();
    const no = Number(tag >> 3n);
    const wire = Number(tag & 7n);
    if (wire === 0) yield { no, wire, int: varint(), bytes: none };
    else if (wire === 1) yield { no, wire, int: 0n, bytes: take(8) };
    else if (wire === 2) yield { no, wire, int: 0n, bytes: take(Number(varint())) };
    else if (wire === 5) yield { no, wire, int: 0n, bytes: take(4) };
    else throw new Error(`unsupported wire type ${wire}`);
  }
}

const utf8 = new TextDecoder();
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

function protoValue(buf: Uint8Array): AttrValue | undefined {
  for (const f of fields(buf)) {
    if (f.no === 1 && f.wire === 2) return utf8.decode(f.bytes);
    if (f.no === 2 && f.wire === 0) return f.int !== 0n;
    if (f.no === 3 && f.wire === 0) return Number(BigInt.asIntN(64, f.int));
    if (f.no === 4 && f.wire === 1) return view(f.bytes).getFloat64(0, true);
  }
  return undefined;
}

function protoKeyValue(buf: Uint8Array, into: Attrs) {
  let key: string | undefined;
  let value: AttrValue | undefined;
  for (const f of fields(buf)) {
    if (f.no === 1 && f.wire === 2) key = utf8.decode(f.bytes);
    else if (f.no === 2 && f.wire === 2) value = protoValue(f.bytes);
  }
  if (key !== undefined && value !== undefined) into[key] = value;
}

function protoSpan(buf: Uint8Array, resource: Attrs): OtelSpan | undefined {
  let traceId = "";
  let spanId = "";
  let parentSpanId = "";
  let name = "";
  let start = 0n;
  let end = 0n;
  const attrs: Attrs = {};
  for (const f of fields(buf)) {
    if (f.wire === 2) {
      if (f.no === 1) traceId = hex(f.bytes);
      else if (f.no === 2) spanId = hex(f.bytes);
      else if (f.no === 4) parentSpanId = hex(f.bytes);
      else if (f.no === 5) name = utf8.decode(f.bytes);
      else if (f.no === 9) protoKeyValue(f.bytes, attrs);
    } else if (f.wire === 1) {
      if (f.no === 7) start = view(f.bytes).getBigUint64(0, true);
      else if (f.no === 8) end = view(f.bytes).getBigUint64(0, true);
    }
  }
  const nanos = end || start;
  if (!traceId || !spanId || nanos === 0n) return undefined;
  return {
    traceId,
    spanId,
    parentSpanId: parentSpanId && !/^0+$/.test(parentSpanId) ? parentSpanId : undefined,
    name,
    at: new Date(Number(nanos / 1_000_000n)),
    attrs,
    resource,
  };
}

export function parseOtlpProto(body: Uint8Array): OtelSpan[] {
  const spans: OtelSpan[] = [];
  for (const rs of fields(body)) {
    if (rs.no !== 1 || rs.wire !== 2) continue; // resource_spans
    const resource: Attrs = {};
    const scopes: Uint8Array[] = [];
    for (const f of fields(rs.bytes)) {
      if (f.wire !== 2) continue;
      if (f.no === 1) {
        for (const r of fields(f.bytes)) if (r.no === 1 && r.wire === 2) protoKeyValue(r.bytes, resource);
      } else if (f.no === 2) scopes.push(f.bytes);
    }
    for (const scope of scopes) {
      for (const f of fields(scope)) {
        if (f.no !== 2 || f.wire !== 2) continue; // spans
        const span = protoSpan(f.bytes, resource);
        if (span) spans.push(span);
      }
    }
  }
  return spans;
}

/** ExportTraceServiceResponse with a partial_success, as protobuf bytes. */
export function protoPartialSuccess(rejected: number, message: string): Uint8Array {
  const varint = (n: number) => {
    const out: number[] = [];
    let v = n;
    while (v > 0x7f) {
      out.push((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    out.push(v);
    return out;
  };
  const text = new TextEncoder().encode(message);
  const inner = [0x08, ...varint(rejected), 0x12, ...varint(text.length), ...text];
  return new Uint8Array([0x0a, ...varint(inner.length), ...inner]);
}
