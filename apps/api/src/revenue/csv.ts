import { REVENUE_TYPES, revenueEventSchema, type RevenueEvent } from "./convert";

// Revenue as a CSV file, for payments that never went through a webhook
// (an export from Stripe, Paddle, Lemon Squeezy, a spreadsheet). Each row
// becomes one revenue event, checked by the same rules as the revenue API.

export const CSV_MAX_ROWS = 5000;

/** Header names people are likely to use, mapped to revenue event fields. */
const COLUMNS: Record<string, keyof RevenueEvent> = {
  id: "id",
  payment_id: "id",
  invoice_id: "id",
  user_id: "userId",
  userid: "userId",
  customer: "userId",
  type: "type",
  ts: "ts",
  date: "ts",
  created: "ts",
  product_id: "productId",
  productid: "productId",
  product: "productId",
  amount_usd: "amountUsd",
  amountusd: "amountUsd",
  amount: "amountUsd",
  net_usd: "netUsd",
  netusd: "netUsd",
  net: "netUsd",
  tax_pct: "taxPct",
  taxpct: "taxPct",
  fee_pct: "feePct",
  feepct: "feePct",
  period_end: "periodEnd",
  periodend: "periodEnd",
  is_trial_conversion: "isTrialConversion",
  istrialconversion: "isTrialConversion",
  trial_conversion: "isTrialConversion",
  one_time: "oneTime",
  onetime: "oneTime",
  environment: "environment",
};

const NUMBERS = new Set<keyof RevenueEvent>(["amountUsd", "netUsd", "taxPct", "feePct"]);
const BOOLEANS = new Set<keyof RevenueEvent>(["isTrialConversion", "oneTime"]);
const DATES = new Set<keyof RevenueEvent>(["ts", "periodEnd"]);

export interface CsvRowError {
  row: number;
  message: string;
}

export interface ParsedCsv {
  events: RevenueEvent[];
  errors: CsvRowError[];
}

/** Splits CSV text into rows of cells (RFC 4180: quoted cells, "" escapes, CRLF). */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** "2026-10-01" counts as midnight UTC; full timestamps pass through. */
function toIso(v: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T00:00:00Z`;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v)) return `${v.replace(" ", "T")}Z`;
  if (/^\d{9,11}$/.test(v)) return new Date(Number(v) * 1000).toISOString();
  return v.replace(" ", "T");
}

function toNumber(v: string): number | string {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : v;
}

function toBoolean(v: string): boolean | string {
  const s = v.toLowerCase();
  if (["true", "yes", "1", "y"].includes(s)) return true;
  if (["false", "no", "0", "n"].includes(s)) return false;
  return v;
}

/**
 * Parses a revenue CSV. The first row names the columns; `id`, `user_id`,
 * `type` and `ts` are required, `amount_usd` too for purchases, renewals
 * and refunds. Bad rows are reported by line number and skipped.
 */
export function parseRevenueCsv(text: string): ParsedCsv {
  const [header, ...body] = splitCsv(text);
  if (!header) return { events: [], errors: [{ row: 1, message: "the file is empty" }] };
  // "Fee %" → fee_pct, "One-time" → one_time, "Payment ID" → payment_id.
  const key = (h: string) =>
    h.trim().toLowerCase().replace(/%/g, " pct").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const fields = header.map((h) => COLUMNS[key(h)]);
  const missing = (["id", "userId", "type", "ts"] as const).filter((f) => !fields.includes(f));
  if (missing.length > 0) {
    const names = { id: "id", userId: "user_id", type: "type", ts: "ts" };
    return { events: [], errors: [{ row: 1, message: `missing column: ${missing.map((m) => names[m]).join(", ")}` }] };
  }
  if (body.length > CSV_MAX_ROWS) {
    return { events: [], errors: [{ row: 1, message: `too many rows (${body.length}); split the file into parts of ${CSV_MAX_ROWS}` }] };
  }

  const events: RevenueEvent[] = [];
  const errors: CsvRowError[] = [];
  body.forEach((cells, i) => {
    const raw: Record<string, unknown> = {};
    fields.forEach((f, col) => {
      const v = cells[col]?.trim() ?? "";
      if (!f || v === "") return;
      if (f === "type") raw[f] = v.toLowerCase();
      else if (NUMBERS.has(f)) raw[f] = toNumber(v);
      else if (BOOLEANS.has(f)) raw[f] = toBoolean(v);
      else if (DATES.has(f)) raw[f] = toIso(v);
      else if (f === "environment") raw[f] = v.toLowerCase();
      else raw[f] = v;
    });
    const parsed = revenueEventSchema.safeParse(raw);
    if (parsed.success) events.push(parsed.data);
    else {
      const issue = parsed.error.issues[0]!;
      const where = issue.path.join(".");
      const hint = where === "type" ? ` (one of ${REVENUE_TYPES.join(", ")})` : "";
      errors.push({ row: i + 2, message: `${where ? `${where}: ` : ""}${issue.message}${hint}` });
    }
  });
  return { events, errors };
}
