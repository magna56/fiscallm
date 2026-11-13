import { Hono } from "hono";
import { getDb } from "./ingest/db";
import { eventsRoute } from "./ingest/route";
import { revenueCatRoute } from "./revenuecat/route";
import { retentionRoute } from "./cron/retention";
import { weeklyReportRoute } from "./cron/weekly-report";
import { dailyRoute } from "./cron/daily";
import { unsubscribeRoute } from "./unsubscribe";
import { importRoute } from "./revenuecat/import/route";
import { revenueRoute } from "./revenue/route";
import { revenueCsvRoute } from "./revenue/csv-route";
import { stripeRoute } from "./stripe/route";
import { stripeImportRoute } from "./stripe/import";
import { checkRoute } from "./check/route";
import { jobsRoute } from "./jobs/route";
import { otelRoute } from "./otel/route";
import { litellmRoute } from "./litellm/route";
import { pricesRoute } from "./prices/route";
import { metricsRoute } from "./metrics/route";
import { mcpRoute } from "./mcp/route";
import { syncRoute } from "./sources/sync";

// Vercel routes /api/* to this service and passes the path through unchanged.
export const app = new Hono().basePath("/api");

app.get("/health", (c) => c.json({ ok: true }));
app.route("/v1/events", eventsRoute(getDb));
app.route("/v1/revenue", revenueRoute(getDb));
app.route("/v1/check", checkRoute(getDb));
app.route("/v1/jobs", jobsRoute(getDb));
// Usage from tools people already run, with no FiscaLLM SDK.
app.route("/v1/otel", otelRoute(getDb));
app.route("/v1/litellm", litellmRoute(getDb));
// Usage read from providers' APIs with a key the customer saved.
app.route("/sources", syncRoute(getDb));
// Reading: an app's numbers (with its key), public list prices, and both as
// tools for AI agents.
app.route("/v1/metrics", metricsRoute(getDb));
app.route("/v1", pricesRoute());
app.route("/mcp", mcpRoute(getDb));
app.route("/webhooks/rc", revenueCatRoute(getDb));
app.route("/webhooks/stripe", stripeRoute(getDb));
app.route("/cron/retention", retentionRoute(getDb));
app.route("/cron/weekly-report", weeklyReportRoute(getDb));
app.route("/cron/daily", dailyRoute(getDb));
app.route("/unsubscribe", unsubscribeRoute(getDb));
app.route("/import/rc", importRoute(getDb));
app.route("/import/revenue-csv", revenueCsvRoute(getDb));
app.route("/import/stripe", stripeImportRoute(getDb));
// RevenueCat OAuth redirects here (the registered redirect URI); the
// dashboard finishes the flow, since it knows who is signed in.
app.get("/oauth/revenuecat/callback", (c) => {
  const query = new URL(c.req.url).search;
  return c.redirect(`/dashboard/connect/revenuecat${query}`, 302);
});

export default app;
