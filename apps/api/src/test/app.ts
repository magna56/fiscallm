import { PGlite } from "@electric-sql/pglite";
import { generateIngestKey, hashKey, MODEL_PRICES, schema } from "@fiscallm/shared";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import type { AnyDb } from "../ingest/db";
import { clearUsageCache } from "../ingest/limit";
import { clearPriceCache } from "../ingest/prices";

// Shared by the route tests: an in-memory database with the real migrations,
// the gpt-4o price row, and a fresh app with an ingest key.

const migrationsFolder = fileURLToPath(new URL("../../../../packages/shared/drizzle", import.meta.url));

export async function testDb(): Promise<AnyDb> {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder });
  const db = pg as unknown as AnyDb;
  await db.insert(schema.modelPrices).values(
    MODEL_PRICES.filter((p) => p.model === "gpt-4o").map((p) => ({
      provider: p.provider,
      model: p.model,
      effectiveFrom: p.effectiveFrom,
      inputPerMtok: String(p.input),
      outputPerMtok: String(p.output),
      cachedPerMtok: String(p.cached),
    })),
  );
  return db;
}

export async function freshApp(db: AnyDb): Promise<{ appId: string; key: string }> {
  clearPriceCache();
  clearUsageCache();
  delete process.env.MONTHLY_EVENT_CAP;
  await db.delete(schema.apps);
  const key = generateIngestKey();
  const [app] = await db
    .insert(schema.apps)
    .values({ name: "test", ownerId: crypto.randomUUID(), ingestKeyHash: await hashKey(key), rcWebhookSecret: "x" })
    .returning();
  return { appId: app!.id, key };
}
