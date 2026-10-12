import { serve } from "@hono/node-server";
import { app } from "./app";

serve({ fetch: app.fetch, port: 8787 }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
