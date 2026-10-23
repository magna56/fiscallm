import {
  bigint,
  boolean,
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
  // Applies RevenueCat SANDBOX events; production events always apply.
  testMode: boolean("test_mode").notNull().default(false),
  // Monday summary email to the owner.
  weeklyEmail: boolean("weekly_email").notNull().default(true),
  // Signs alert webhooks (X-FiscaLLM-Signature); created with the first one.
  alertSecret: text("alert_secret"),
  // Stripe webhook signing secret (whsec_...), stored sealed. Set when the
  // owner connects Stripe; null means no Stripe connection.
  stripeWebhookSecretCipher: text("stripe_webhook_secret_cipher"),
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
    // inputTokens excludes cache reads and cache writes, which are counted
    // separately because they are priced differently.
    cachedTokens: bigint("cached_tokens", { mode: "number" }),
    cacheWriteTokens: bigint("cache_write_tokens", { mode: "number" }),
    // Non-token usage: e.g. 12.5 minutes, or 8 seconds of "1080p" video.
    units: numeric("units", { precision: 18, scale: 6 }),
    unit: text("unit"),
    variant: text("variant"),
    // Null when the model is not in the price table yet.
    costUsd: usd("cost_usd"),
    costSource: text("cost_source", {
      enum: ["table", "override", "client"],
    }).notNull(),
    feature: text("feature"),
    // Your own id for the unit of work the call belongs to, e.g. a video
    // render. Joins the cost to the job's outcome in `jobs`.
    jobId: text("job_id"),
  },
  (t) => [
    primaryKey({ columns: [t.appId, t.id] }),
    index("ai_events_app_user_ts").on(t.appId, t.userId, t.ts),
    index("ai_events_app_job").on(t.appId, t.jobId),
  ],
).enableRLS();

export const JOB_STATUSES = ["pending", "captured", "refunded"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

// What happened to the user's payment for a job: still held ("pending"),
// charged ("captured") or given back ("refunded"). Cost on jobs that were
// refunded, or never resolved, is cost the user did not pay for.
export const jobs = pgTable(
  "jobs",
  {
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    jobId: text("job_id").notNull(),
    userId: text("user_id").notNull(),
    status: text("status", { enum: JOB_STATUSES }).notNull(),
    // When the status took effect; older reports never overwrite newer ones.
    statusAt: ts("status_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.appId, t.jobId] }),
    index("jobs_app_status_at").on(t.appId, t.statusAt),
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
    // Null means cache reads or writes are billed at the input price.
    cachedPerMtok: usd("cached_per_mtok"),
    cacheWritePerMtok: usd("cache_write_per_mtok"),
    // Prompts longer than this many tokens (input + cache reads + cache
    // writes) are billed at the long_* prices.
    longContextThreshold: integer("long_context_threshold"),
    longInputPerMtok: usd("long_input_per_mtok"),
    longOutputPerMtok: usd("long_output_per_mtok"),
    longCachedPerMtok: usd("long_cached_per_mtok"),
    longCacheWritePerMtok: usd("long_cache_write_per_mtok"),
    // USD per unit, keyed "minute" or "second:1080p".
    unitPrices: jsonb("unit_prices").$type<Record<string, number>>(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.model, t.effectiveFrom] })],
).enableRLS();

// A customer's negotiated pricing. model '*' covers every model of the
// provider; a row for the exact model wins over it.
export const appPriceOverrides = pgTable(
  "app_price_overrides",
  {
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull().default("*"),
    effectiveFrom: date("effective_from").notNull(),
    // Either a discount on the list price, or flat prices of their own.
    discountPct: numeric("discount_pct", { precision: 7, scale: 4 }),
    inputPerMtok: usd("input_per_mtok"),
    outputPerMtok: usd("output_per_mtok"),
    cachedPerMtok: usd("cached_per_mtok"),
    cacheWritePerMtok: usd("cache_write_per_mtok"),
  },
  (t) => [
    primaryKey({
      columns: [t.appId, t.provider, t.model, t.effectiveFrom],
    }),
  ],
).enableRLS();

export const rcEvents = pgTable(
  "rc_events",
  {
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    // RevenueCat event id; retries reuse it.
    id: text("id").notNull(),
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
    isTrialConversion: boolean("is_trial_conversion"),
    purchasedAt: ts("purchased_at"),
    expirationAt: ts("expiration_at"),
    eventTs: ts("event_ts").notNull(),
    raw: jsonb("raw").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.appId, t.id] }),
    index("rc_events_app_user").on(t.appId, t.appUserId),
    index("rc_events_app_original_user").on(t.appId, t.originalAppUserId),
  ],
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
  (t) => [
    primaryKey({ columns: [t.appId, t.alias] }),
    index("user_aliases_app_canonical").on(t.appId, t.canonicalUserId),
  ],
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

// One RevenueCat history import per app; resumable in chunks.
export const rcImports = pgTable("rc_imports", {
  appId: uuid("app_id")
    .primaryKey()
    .references(() => apps.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["running", "done", "failed", "cancelled"] }).notNull(),
  projectId: text("project_id").notNull(),
  // AES-GCM encrypted v2 secret key; cleared when the import ends.
  keyCipher: text("key_cipher"),
  // Last customer id processed (RevenueCat's starting_after).
  cursor: text("cursor"),
  // Transactions on or after this time came by webhook; skip them.
  cutoff: ts("cutoff").notNull(),
  customersDone: integer("customers_done").notNull().default(0),
  eventsImported: integer("events_imported").notNull().default(0),
  error: text("error"),
  // Set while a chunk runs, so two chunks never process one app at once.
  lockedUntil: ts("locked_until"),
  startedAt: ts("started_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
}).enableRLS();

export const ALERT_KINDS = [
  "user_daily_cost",
  "user_30d_cost",
  "user_losing",
  "app_cost_share",
  "app_daily_cost",
  "unpriced_model",
  "user_burst",
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const alertRules = pgTable(
  "alert_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ALERT_KINDS }).notNull(),
    // USD, or a fraction for app_cost_share; unused for unpriced_model.
    threshold: numeric("threshold", { precision: 18, scale: 8 }),
    email: boolean("email").notNull().default(true),
    webhookUrl: text("webhook_url"),
    // For the per-user budgets: also refuse the user in POST /v1/check, so the
    // backend can block or downgrade their calls (see meter.check in the SDKs).
    enforce: boolean("enforce").notNull().default(false),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("alert_rules_app").on(t.appId)],
).enableRLS();

// Sent alerts. The unique key makes each rule fire once per subject per day.
export const alertEvents = pgTable(
  "alert_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => alertRules.id, { onDelete: "cascade" }),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    // A user id, "app", or a model for unpriced_model.
    subject: text("subject").notNull(),
    period: date("period").notNull(),
    payload: jsonb("payload").notNull(),
    delivery: jsonb("delivery"),
    sentAt: ts("sent_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("alert_events_once").on(t.ruleId, t.subject, t.period),
    index("alert_events_app_sent").on(t.appId, t.sentAt),
  ],
).enableRLS();

// Who signed up: one row per Supabase user, filled in on the welcome step.
export const profiles = pgTable("profiles", {
  // Supabase auth.users.id
  userId: uuid("user_id").primaryKey(),
  fullName: text("full_name").notNull(),
  company: text("company").notNull(),
  website: text("website"),
  role: text("role"),
  teamSize: text("team_size"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}).enableRLS();
