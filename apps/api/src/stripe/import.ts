import { openSecret, schema } from "@fiscallm/shared";
import { waitUntil } from "@vercel/functions";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AnyDb } from "../ingest/db";
import { mapStripeEvent, type StripeEvent } from "./map";
import { stripeContext, storeStripeEvents } from "./route";
import { type StripeRequest, stripeRequest } from "./settlement";

// Imports past Stripe payments, refunds, current trials and ended
// subscriptions through Stripe's API, so revenue from before the webhook was
// added counts too. Each list object is wrapped as the webhook event it
// stands for and goes through the same mapper, so both paths agree; an
// invoice already stored by either one is skipped.
//
// Runs in ~50 s chunks that chain into each other. The Stripe key travels
// sealed in the chain's request body and is never written to the database.

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const num = (v: unknown) => (typeof v === "number" ? v : undefined);

export interface StripePage {
  data: Rec[];
  has_more: boolean;
}
export type StripeGet = (path: string, params: Record<string, string>) => Promise<StripePage>;

export const stripeApi = (key: string): StripeGet => stripeRequest(key) as unknown as StripeGet;

interface Phase {
  path: string;
  params: (since: number) => Record<string, string>;
  /** The webhook event this list object stands for, or null to skip it. */
  toEvent: (o: Rec, since: number) => StripeEvent | null;
}

const PHASES: Phase[] = [
  {
    path: "/v1/invoices",
    params: (since) => ({ status: "paid", "created[gte]": String(since) }),
    toEvent: (inv) => ({ id: `import_${inv.id}`, type: "invoice.paid", created: num(rec(inv.status_transitions).paid_at) ?? inv.created, livemode: inv.livemode, data: { object: inv } }),
  },
  {
    path: "/v1/refunds",
    params: (since) => ({ "created[gte]": String(since), "expand[]": "data.charge" }),
    toEvent: (r) => {
      const charge = rec(r.charge);
      if (r.status !== "succeeded" || !charge.id) return null;
      return { id: `import_${r.id}`, type: "charge.refunded", created: r.created, livemode: charge.livemode, data: { object: charge } };
    },
  },
  {
    path: "/v1/subscriptions",
    params: () => ({ status: "trialing" }),
    toEvent: (s) => ({ id: `import_trial_${s.id}`, type: "customer.subscription.created", created: num(s.trial_start) ?? s.created, livemode: s.livemode, data: { object: s } }),
  },
  {
    path: "/v1/subscriptions",
    params: () => ({ status: "canceled" }),
    toEvent: (s, since) =>
      (num(s.ended_at) ?? 0) >= since ? { id: `import_end_${s.id}`, type: "customer.subscription.deleted", created: s.ended_at, livemode: s.livemode, data: { object: s } } : null,
  },
];

export interface ImportState {
  phase: number;
  cursor?: string;
  /** Unix seconds; nothing older is imported. */
  since: number;
  stored: number;
  skipped: number;
}

export const importDone = (s: ImportState) => s.phase >= PHASES.length;

/** Imports until done or the deadline; returns the totals and where to resume. */
export async function runStripeImportChunk(db: AnyDb, app: { id: string; testMode: boolean }, get: StripeGet, state: ImportState, deadline: number): Promise<ImportState> {
  const s = { ...state };
  // The import key can read balance transactions too, so imported payments get exact fees.
  const ctx = stripeContext(db, app.id, get as unknown as StripeRequest);
  while (s.phase < PHASES.length) {
    if (Date.now() > deadline) return s;
    const phase = PHASES[s.phase]!;
    const page = await get(phase.path, { ...phase.params(s.since), limit: "100", ...(s.cursor ? { starting_after: s.cursor } : {}) });
    for (const obj of page.data) {
      const event = phase.toEvent(obj, s.since);
      const mapped = event ? await mapStripeEvent(event, ctx) : null;
      if (!mapped || mapped.events.length === 0) {
        s.skipped++;
        continue;
      }
      const r = await storeStripeEvents(db, app, mapped);
      s.stored += r.accepted;
      s.skipped += r.duplicates;
    }
    const last = page.data.at(-1)?.id;
    if (page.has_more && typeof last === "string") s.cursor = last;
    else {
      s.phase++;
      s.cursor = undefined;
    }
  }
  return s;
}

const CHUNK_MS = 50_000;

/** POST /api/import/stripe/run: one chunk of a Stripe history import, then the next. */
export function stripeImportRoute(getDb: () => AnyDb, makeApi: (key: string) => StripeGet = stripeApi) {
  return new Hono().post("/run", async (c) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || c.req.header("authorization") !== `Bearer ${secret}`) return c.json({ error: "unauthorized" }, 401);
    const body = ((await c.req.json().catch(() => ({}))) ?? {}) as { appId?: string; keyCipher?: string; state?: ImportState };
    if (!body.appId || !body.keyCipher || !body.state) return c.json({ error: "appId, keyCipher and state required" }, 400);

    const db = getDb();
    const [app] = await db.select({ id: schema.apps.id, testMode: schema.apps.testMode }).from(schema.apps).where(eq(schema.apps.id, body.appId)).limit(1);
    if (!app) return c.json({ error: "unknown app" }, 404);
    const key = await openSecret(secret, body.keyCipher).catch(() => null);
    if (!key) return c.json({ error: "bad key" }, 400);

    const baseUrl = process.env.PUBLIC_URL ?? "https://fiscallm.com";
    const work = runStripeImportChunk(db, app, makeApi(key), body.state, Date.now() + CHUNK_MS)
      .then(async (next) => {
        if (importDone(next)) {
          console.log(`stripe import done for ${app.id}: ${next.stored} stored, ${next.skipped} skipped`);
          return;
        }
        await fetch(`${baseUrl}/api/import/stripe/run`, {
          method: "POST",
          headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
          body: JSON.stringify({ appId: app.id, keyCipher: body.keyCipher, state: next }),
          signal: AbortSignal.timeout(10_000),
        }).catch(() => {});
      })
      .catch((e) => console.error("stripe import chunk failed", app.id, e instanceof Error ? e.message : e));
    waitUntil(work);
    return c.json({ accepted: true }, 202);
  });
}
