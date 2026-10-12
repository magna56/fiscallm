import {
  bigint,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const usd = (name: string) => numeric(name, { precision: 18, scale: 8 });
// Tables live in the public schema, which Supabase exposes over its REST API.
// RLS with no policies blocks that path; the API connects as the table owner.
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const apps = pgTable("apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Supabase auth.users.id
  ownerId: uuid("owner_id").notNull(),
  name: text("name").notNull(),
  ingestKeyHash: text("ingest_key_hash").notNull().unique(),
  rcWebhookSecret: text("rc_webhook_secret").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}).enableRLS();

export const aiEvents = pgTable(
  "ai_events",
  {
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    // Client-generated UUID, so SDK retries cannot double count.
    id: uuid("id").notNull(),
    userId: text("user_id").notNull(),
    ts: ts("ts").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: bigint("input_tokens", { mode: "number" }),
    outputTokens: bigint("output_tokens", { mode: "number" }),
    cachedTokens: bigint("cached_tokens", { mode: "number" }),
    // Null when the model is not in the price table yet.
    costUsd: usd("cost_usd"),
    costSource: text("cost_source", { enum: ["table", "client"] }).notNull(),
    feature: text("feature"),
  },
  (t) => [
    primaryKey({ columns: [t.appId, t.id] }),
    index("ai_events_app_user_ts").on(t.appId, t.userId, t.ts),
  ],
).enableRLS();

export const modelPrices = pgTable(
  "model_prices",
  {
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    inputPerMtok: usd("input_per_mtok").notNull(),
    outputPerMtok: usd("output_per_mtok").notNull(),
    cachedPerMtok: usd("cached_per_mtok"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.model, t.effectiveFrom] })],
).enableRLS();

export const rcEvents = pgTable(
  "rc_events",
  {
    // RevenueCat event id; retries reuse it.
    id: text("id").primaryKey(),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    appUserId: text("app_user_id"),
    originalAppUserId: text("original_app_user_id"),
    productId: text("product_id"),
    periodType: text("period_type"),
    store: text("store"),
    environment: text("environment"),
    priceUsd: usd("price_usd"),
    taxPct: numeric("tax_pct", { precision: 7, scale: 4 }),
    commissionPct: numeric("commission_pct", { precision: 7, scale: 4 }),
    netUsd: usd("net_usd"),
    purchasedAt: ts("purchased_at"),
    expirationAt: ts("expiration_at"),
    eventTs: ts("event_ts").notNull(),
    raw: jsonb("raw").notNull(),
  },
  (t) => [index("rc_events_app_user").on(t.appId, t.appUserId)],
).enableRLS();

export const userAliases = pgTable(
  "user_aliases",
  {
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    canonicalUserId: text("canonical_user_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.appId, t.alias] })],
).enableRLS();

export const subscribers = pgTable(
  "subscribers",
  {
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    state: text("state", {
      enum: ["trial", "paid", "cancelled", "expired"],
    }).notNull(),
    productId: text("product_id"),
    trialStartedAt: ts("trial_started_at"),
    convertedAt: ts("converted_at"),
    expiresAt: ts("expires_at"),
    netRevenueUsd: usd("net_revenue_usd").notNull().default("0"),
  },
  (t) => [primaryKey({ columns: [t.appId, t.userId] })],
).enableRLS();

export const dailyUserCost = pgTable(
  "daily_user_cost",
  {
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    day: date("day").notNull(),
    costUsd: usd("cost_usd").notNull().default("0"),
    requests: integer("requests").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.appId, t.userId, t.day] }),
    uniqueIndex("daily_user_cost_app_day_user").on(t.appId, t.day, t.userId),
  ],
).enableRLS();
