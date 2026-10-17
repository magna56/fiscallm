import { Hono } from "hono";
import { getDb } from "./ingest/db";
import { eventsRoute } from "./ingest/route";
import { revenueCatRoute } from "./revenuecat/route";
import { retentionRoute } from "./cron/retention";
import { weeklyReportRoute } from "./cron/weekly-report";
import { unsubscribeRoute } from "./unsubscribe";

// Vercel routes /api/* to this service and passes the path through unchanged.
export const app = new Hono().basePath("/api");

app.get("/health", (c) => c.json({ ok: true }));
app.route("/v1/events", eventsRoute(getDb));
app.route("/webhooks/rc", revenueCatRoute(getDb));
app.route("/cron/retention", retentionRoute(getDb));
app.route("/cron/weekly-report", weeklyReportRoute(getDb));
app.route("/unsubscribe", unsubscribeRoute(getDb));

export default app;
