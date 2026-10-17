// Creates an app and prints its ingest key once; only the hash is stored.
// Usage: pnpm create-app "<name>" [owner user id]
import { existsSync } from "node:fs";
import { createDb } from "../src/db";
import { generateIngestKey, generateWebhookSecret, hashKey } from "../src/keys";
import { apps } from "../src/schema";

if (existsSync(".env")) process.loadEnvFile(".env");

const [name, ownerId = "00000000-0000-0000-0000-000000000000"] = process.argv.slice(2);
if (!name) throw new Error('Usage: pnpm create-app "<name>" [owner user id]');

const db = createDb(process.env.DATABASE_URL!);
const key = generateIngestKey();
const [app] = await db
  .insert(apps)
  .values({ name, ownerId, ingestKeyHash: await hashKey(key), rcWebhookSecret: generateWebhookSecret() })
  .returning({ id: apps.id });

console.log(`app id:     ${app!.id}\ningest key: ${key}`);
await db.$client.end();
