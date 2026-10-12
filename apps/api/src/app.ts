import { Hono } from "hono";

// Vercel routes /api/* to this service and passes the path through unchanged.
export const app = new Hono().basePath("/api");

app.get("/health", (c) => c.json({ ok: true }));

export default app;
