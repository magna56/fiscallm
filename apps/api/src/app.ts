import { Hono } from "hono";
import { getDb } from "./ingest/db";
import { eventsRoute } from "./ingest/route";

// Vercel routes /api/* to this service and passes the path through unchanged.
export const app = new Hono().basePath("/api");

app.get("/health", (c) => c.json({ ok: true }));
app.route("/v1/events", eventsRoute(getDb));

export default app;
