import { PGlite } from "@electric-sql/pglite";
import { schema } from "@fiscallm/shared";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import type { AnyDb } from "../ingest/db";
import { retentionRoute } from "./retention";

afterEach(() => {
  delete process.env.CRON_SECRET;
});

it("deletes only raw events older than 90 days, and checks the cron secret", async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: fileURLToPath(new URL("../../../../packages/shared/drizzle", import.meta.url)) });
  const db = pg as unknown as AnyDb;
  const [app] = await db
    .insert(schema.apps)
    .values({ name: "t", ownerId: crypto.randomUUID(), ingestKeyHash: "h", rcWebhookSecret: "s" })
    .returning();
  const event = (daysAgo: number) => ({
    appId: app!.id,
    id: crypto.randomUUID(),
    userId: "u",
    ts: new Date(Date.now() - daysAgo * 86_400_000),
    provider: "openai",
    model: "gpt-4o",
    costSource: "table" as const,
  });
  await db.insert(schema.aiEvents).values([event(1), event(89), event(91), event(400)]);

  process.env.CRON_SECRET = "s3";
  const route = retentionRoute(() => db);
  expect((await route.request("/")).status).toBe(401);
  const res = await route.request("/", { headers: { authorization: "Bearer s3" } });
  expect(((await res.json()) as { deleted: number }).deleted).toBe(2);
  expect(await db.select().from(schema.aiEvents)).toHaveLength(2);
});
