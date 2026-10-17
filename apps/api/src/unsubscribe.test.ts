import { PGlite } from "@electric-sql/pglite";
import { schema, unsubscribeToken } from "@fiscallm/shared";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { AnyDb } from "./ingest/db";
import { weeklyReportRoute } from "./cron/weekly-report";
import { unsubscribeRoute } from "./unsubscribe";

let db: AnyDb;
let appId: string;

beforeAll(async () => {
  process.env.CRON_SECRET = "s";
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: fileURLToPath(new URL("../../../packages/shared/drizzle", import.meta.url)) });
  db = pg as unknown as AnyDb;
  const [app] = await db
    .insert(schema.apps)
    .values({ name: "t", ownerId: crypto.randomUUID(), ingestKeyHash: "h", rcWebhookSecret: "x" })
    .returning();
  appId = app!.id;
});
afterAll(() => {
  delete process.env.CRON_SECRET;
});

const weekly = async () => (await db.select().from(schema.apps))[0]!.weeklyEmail;

it("turns the weekly email off only with a valid signed link", async () => {
  const route = unsubscribeRoute(() => db);
  expect((await route.request(`/?app=${appId}&t=forged`)).status).toBe(400);
  expect(await weekly()).toBe(true);

  const t = await unsubscribeToken("s", appId);
  const res = await route.request(`/?app=${appId}&t=${t}`, { method: "POST" });
  expect(res.status).toBe(200);
  expect(await weekly()).toBe(false);
});

it("refuses to run the weekly job without the cron secret", async () => {
  expect((await weeklyReportRoute(() => db).request("/")).status).toBe(401);
});
