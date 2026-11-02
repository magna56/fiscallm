import { PGlite } from "@electric-sql/pglite";
import { schema } from "@fiscallm/shared";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnyDb } from "../ingest/db";
import { revenueCsvRoute } from "./csv-route";
import { parseRevenueCsv, splitCsv } from "./csv";

let db: AnyDb;
let appId: string;
const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString().slice(0, 10);
const ahead = (d: number) => new Date(Date.now() + d * DAY).toISOString().slice(0, 10);
const prevSecret = process.env.CRON_SECRET;

beforeAll(async () => {
  process.env.CRON_SECRET = "test-secret";
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: fileURLToPath(new URL("../../../../packages/shared/drizzle", import.meta.url)) });
  db = pg as unknown as AnyDb;
});
afterAll(() => {
  process.env.CRON_SECRET = prevSecret;
});

beforeEach(async () => {
  await db.delete(schema.apps);
  const [app] = await db.insert(schema.apps).values({ name: "t", ownerId: crypto.randomUUID(), ingestKeyHash: "h", rcWebhookSecret: "x" }).returning();
  appId = app!.id;
});

const upload = (csv: string, auth = "Bearer test-secret") =>
  revenueCsvRoute(() => db).request("/", { method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify({ appId, csv }) });
const subscriber = async (u: string) => (await db.select().from(schema.subscribers).where(eq(schema.subscribers.userId, u)))[0];

describe("splitCsv", () => {
  it("handles quotes, escaped quotes, CRLF and a BOM", () => {
    expect(splitCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });
});

describe("parseRevenueCsv", () => {
  it("accepts common header names, dates, $ amounts and yes/no", () => {
    const { events, errors } = parseRevenueCsv(
      `Payment ID,Customer,Type,Date,Amount,Fee %,Product,One-time\npay_1,u1,Purchase,${ago(3)},"$1,200.50",0.03,lifetime,yes\n`,
    );
    expect(errors).toEqual([]);
    expect(events[0]).toMatchObject({ id: "pay_1", userId: "u1", type: "purchase", amountUsd: 1200.5, feePct: 0.03, productId: "lifetime", oneTime: true });
  });

  it("names a missing required column", () => {
    expect(parseRevenueCsv("id,user_id,amount\n1,u,5").errors[0]!.message).toBe("missing column: type, ts");
  });

  it("reports bad rows by line number and keeps the good ones", () => {
    const { events, errors } = parseRevenueCsv(`id,user_id,type,ts,amount_usd\na,u,purchase,${ago(1)},5\nb,u,gift,${ago(1)},5\nc,u,renewal,${ago(1)},\n`);
    expect(events.map((e) => e.id)).toEqual(["a"]);
    expect(errors.map((e) => e.row)).toEqual([3, 4]);
    expect(errors[0]!.message).toContain("one of trial_started");
    expect(errors[1]!.message).toContain("amountUsd");
  });
});

describe("POST /import/revenue-csv", () => {
  it("needs the server secret", async () => {
    expect((await upload("x", "Bearer nope")).status).toBe(401);
  });

  it("stores rows as revenue, joins users and ignores re-uploads", async () => {
    const csv = [
      "id,user_id,type,ts,amount_usd,net_usd,product_id,period_end,is_trial_conversion",
      `t1,u1,trial_started,${ago(20)},,,pro,${ago(13)},`,
      `p1,u1,renewal,${ago(13)},10,8,pro,${ahead(17)},true`,
      `p2,u2,purchase,${ago(5)},20,17,pro,${ahead(25)},`,
    ].join("\n");
    expect(await (await upload(csv)).json()).toEqual({ accepted: 3, duplicates: 0, skipped: 0, errors: [] });
    expect(await subscriber("u1")).toMatchObject({ state: "paid", productId: "pro" });
    expect(Number((await subscriber("u1"))!.netRevenueUsd)).toBe(8);
    expect(Number((await subscriber("u2"))!.netRevenueUsd)).toBe(17);
    const [row] = await db.select().from(schema.rcEvents).where(eq(schema.rcEvents.id, "csv:p2"));
    expect(row!.store).toBe("CSV");

    expect(await (await upload(csv)).json()).toMatchObject({ accepted: 0, duplicates: 3 });
    expect(Number((await subscriber("u2"))!.netRevenueUsd)).toBe(17);
  });
});
