import { estimateCost, findListed, PRICES_CHECKED } from "@fiscallm/shared";
import { Hono } from "hono";
import type { AnyDb } from "../ingest/db";
import { appForKey, bearer } from "../ingest/pipeline";
import { readMetric } from "../metrics/route";
import { listPrices, PRICE_META, publicPrice } from "../prices/route";

// A Model Context Protocol server (Streamable HTTP, stateless): AI agents can
// look up model prices, estimate costs, and, with an app's key, read that
// app's cost and margin per user. Each POST is one JSON-RPC message answered
// with JSON; there are no sessions and no server-sent events.

const SITE = "https://fiscallm.com";
const PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER = { name: "fiscallm", title: "FiscaLLM", version: "1.0.0", websiteUrl: SITE };

const INSTRUCTIONS =
  "FiscaLLM tracks what each user of an AI product costs in model calls, next to the revenue from that user. " +
  "Price and estimate tools need no key and use list prices checked against the providers' pricing pages. " +
  "Margin tools read one app's data and need its key (starts with fsk_) in the Authorization header: Bearer <key>. " +
  "Call fiscallm_setup_guide to learn how to start sending usage.";

type Json = Record<string, unknown>;
type Args = Record<string, unknown>;

interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Json;
  /** Reads one app's data, so the request must carry that app's key. */
  needsKey?: boolean;
  run: (args: Args, ctx: { db: () => AnyDb; appId?: string }) => Promise<unknown> | unknown;
}

const num = (v: unknown, fallback: number) => {
  const n = Number(v ?? fallback);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
const days = { type: "integer", minimum: 1, maximum: 365, default: 30, description: "How many days back to look, counting today." };
const tokenProps = {
  inputTokens: { type: "integer", minimum: 0, description: "Prompt tokens per call, including any cached ones." },
  outputTokens: { type: "integer", minimum: 0, description: "Reply tokens per call." },
  cachedTokens: { type: "integer", minimum: 0, default: 0, description: "How many of the prompt tokens are read from the prompt cache." },
};

class ToolError extends Error {}

function estimateOrThrow(model: string, a: Args) {
  const e = estimateCost({
    model,
    inputTokens: num(a.inputTokens, 0),
    outputTokens: num(a.outputTokens, 0),
    cachedTokens: num(a.cachedTokens, 0),
    cacheWriteTokens: num(a.cacheWriteTokens, 0),
    calls: num(a.calls, 1),
  });
  if (!e) throw new ToolError(`Unknown model "${model}". Call list_llm_prices to see the model ids.`);
  return e;
}

const SETUP_GUIDE = {
  what: "FiscaLLM limits AI usage by subscription plan (free, trial, paid or a product) and shows the AI cost of each user next to the revenue from that user (RevenueCat or Stripe), so you can see who loses money. Open source (MIT), free hosted plan, no proxy: your AI calls go straight to the provider and only token counts are reported.",
  signUp: `${SITE}/login`,
  docs: `${SITE}/docs`,
  waysToSendUsage: [
    { name: "OpenTelemetry", how: `Point an OTLP/HTTP trace exporter at ${SITE}/api/v1/otel with header "Authorization: Bearer <ingest key>". Spans that follow the GenAI conventions (Vercel AI SDK, OpenLLMetry, OpenInference) become cost events. Set the "user.id" attribute.`, guide: `${SITE}/integrations/opentelemetry` },
    { name: "LiteLLM", how: `Add a generic_api callback with endpoint ${SITE}/api/v1/litellm and the same Authorization header. LiteLLM's own cost figure is used. Send "user" with each request.`, guide: `${SITE}/integrations/litellm` },
    { name: "SDK", how: 'npm install fiscallm (or pip install fiscallm), then meter.trackOpenAI(response, { userId }) after each call. Also trackAnthropic and trackGemini.', guide: `${SITE}/docs` },
    { name: "HTTP", how: `POST ${SITE}/api/v1/events with a batch of events.`, guide: `${SITE}/docs` },
  ],
  revenue: "Connect RevenueCat (one click) or Stripe, or POST /api/v1/revenue. The user id on usage must be the same id the revenue source knows.",
  limitsByPlan: `Set an allowance per plan on the app's Limits page (AI calls or USD; per day, per month or in total). Before each AI call, call meter.check(userId) or POST ${SITE}/api/v1/check with { "userId" } and the ingest key. The answer has allow, reason, plan and limits (limit, used, remaining, resetsAt), for an in-app "3 left today" and a paywall at zero. Guide: ${SITE}/guides/ai-usage-limits-by-plan`,
  readBack: `GET ${SITE}/api/v1/metrics/overview, /users, /plans and /breakdown with the same key, or the margin tools of this server.`,
  agentSkill: `${SITE}/skill.md`,
  source: "https://github.com/magna56/fiscallm",
};

export const TOOLS: Tool[] = [
  {
    name: "list_llm_prices",
    title: "List LLM API prices",
    description:
      "Current list prices (USD per 1M tokens: input, cached input, output) for OpenAI, Anthropic and Google models, with announced price changes. Use it to find a model id or to compare prices.",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string", enum: ["openai", "anthropic", "google"], description: "Only this provider's models." },
        search: { type: "string", description: 'Only models whose id contains this text, e.g. "haiku" or "gpt-5".' },
      },
    },
    run: (a) => {
      const models = listPrices({ provider: str(a.provider), q: str(a.search) });
      return { ...PRICE_META, count: models.length, models };
    },
  },
  {
    name: "get_llm_price",
    title: "Get one model's price",
    description: 'Current list price of one model by id, e.g. "gpt-4o-mini" or "claude-sonnet-4-5". Includes the long-context rate and any announced change.',
    inputSchema: { type: "object", properties: { model: { type: "string", description: "Model id." } }, required: ["model"] },
    run: (a) => {
      const listed = findListed(str(a.model) ?? "");
      if (!listed) throw new ToolError(`Unknown model "${String(a.model)}". Call list_llm_prices to see the model ids.`);
      return { ...PRICE_META, model: publicPrice(listed) };
    },
  },
  {
    name: "estimate_llm_cost",
    title: "Estimate the cost of LLM calls",
    description: "USD cost of a call to a model from its token counts, at list price, and the total for a number of such calls.",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Model id." },
        ...tokenProps,
        cacheWriteTokens: { type: "integer", minimum: 0, default: 0, description: "Prompt tokens written to the cache (Anthropic)." },
        calls: { type: "integer", minimum: 1, default: 1, description: "Number of calls like this one." },
      },
      required: ["model", "inputTokens", "outputTokens"],
    },
    run: (a) => ({ ...estimateOrThrow(str(a.model) ?? "", a), currency: "USD", pricesChecked: PRICES_CHECKED }),
  },
  {
    name: "compare_llm_costs",
    title: "Compare the cost of the same workload on several models",
    description: "USD cost of the same call (same token counts) on each of several models, cheapest first. Use it to pick a model or to price a switch.",
    inputSchema: {
      type: "object",
      properties: {
        models: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 20, description: "Model ids to compare." },
        ...tokenProps,
        calls: { type: "integer", minimum: 1, default: 1, description: "Number of calls like this one, e.g. per user per month." },
      },
      required: ["models", "inputTokens", "outputTokens"],
    },
    run: (a) => {
      const models = Array.isArray(a.models) ? a.models.map(str).filter((m): m is string => Boolean(m)).slice(0, 20) : [];
      if (models.length < 2) throw new ToolError("Give at least two model ids in `models`.");
      const rows = models.map((m) => estimateOrThrow(m, a)).sort((x, y) => x.totalUsd - y.totalUsd);
      const cheapest = rows[0]!.totalUsd;
      return {
        currency: "USD",
        pricesChecked: PRICES_CHECKED,
        results: rows.map((r) => ({ ...r, timesCheapest: cheapest > 0 ? Math.round((r.totalUsd / cheapest) * 100) / 100 : null })),
      };
    },
  },
  {
    name: "subscription_break_even",
    title: "Break-even usage for a subscription price",
    description:
      "How many AI messages a month a subscriber can send before the model cost uses up what the plan earns, after the store or payment fee. Answers: does this plan price cover this model?",
    inputSchema: {
      type: "object",
      properties: {
        model: { type: "string", description: "Model id." },
        monthlyPriceUsd: { type: "number", exclusiveMinimum: 0, description: "The plan's price per month." },
        feePercent: { type: "number", minimum: 0, maximum: 100, default: 15, description: "Store or payment fee. App stores take 15 to 30; Stripe about 3." },
        inputTokens: { type: "integer", minimum: 0, default: 1500, description: "Prompt tokens per message (system prompt and history)." },
        outputTokens: { type: "integer", minimum: 0, default: 400, description: "Reply tokens per message." },
        cachedTokens: { type: "integer", minimum: 0, default: 0, description: "How many of the prompt tokens are read from the prompt cache." },
        messagesPerMonth: { type: "integer", minimum: 0, description: "Optional: a user's expected messages a month, to get that user's margin." },
      },
      required: ["model", "monthlyPriceUsd"],
    },
    run: (a) => {
      const price = num(a.monthlyPriceUsd, 0);
      if (price <= 0) throw new ToolError("monthlyPriceUsd must be above 0.");
      const fee = Math.min(num(a.feePercent, 15), 100);
      const one = estimateOrThrow(str(a.model) ?? "", { ...a, inputTokens: a.inputTokens ?? 1500, outputTokens: a.outputTokens ?? 400, calls: 1 });
      const net = Math.round(price * (1 - fee / 100) * 100) / 100;
      const out: Json = {
        model: one.model,
        provider: one.provider,
        costPerMessageUsd: one.costUsd,
        netRevenuePerMonthUsd: net,
        breakEvenMessagesPerMonth: one.costUsd > 0 ? Math.floor(net / one.costUsd) : null,
        pricesChecked: PRICES_CHECKED,
      };
      if (a.messagesPerMonth !== undefined) {
        const messages = Math.round(num(a.messagesPerMonth, 0));
        const aiCost = Math.round(one.costUsd * messages * 100) / 100;
        out.atMessagesPerMonth = { messages, aiCostUsd: aiCost, marginUsd: Math.round((net - aiCost) * 100) / 100, losesMoney: aiCost > net };
      }
      return out;
    },
  },
  {
    name: "fiscallm_setup_guide",
    title: "How to set up FiscaLLM",
    description: "What FiscaLLM is and the ways to send it AI usage (OpenTelemetry, LiteLLM, SDK, HTTP), connect revenue, and read margins back.",
    inputSchema: { type: "object", properties: {} },
    run: () => SETUP_GUIDE,
  },
  {
    name: "get_margin_overview",
    title: "AI cost, revenue and margin of the app",
    description: "The app's AI cost, revenue, margin, share of revenue spent on AI, request count and daily series over a period. Needs the app's key.",
    inputSchema: { type: "object", properties: { days } },
    needsKey: true,
    run: (a, ctx) => readMetric(ctx.db(), ctx.appId!, "overview", { days: a.days }),
  },
  {
    name: "list_users_by_margin",
    title: "Users by margin, worst first",
    description: "Each user's AI cost, revenue and margin over a period, the users losing the most money first. Needs the app's key.",
    inputSchema: {
      type: "object",
      properties: {
        days,
        losingOnly: { type: "boolean", default: false, description: "Only users whose AI cost is above their revenue." },
        limit: { type: "integer", minimum: 1, maximum: 500, default: 25 },
      },
    },
    needsKey: true,
    run: (a, ctx) => readMetric(ctx.db(), ctx.appId!, "users", { days: a.days, losingOnly: a.losingOnly === true, limit: a.limit ?? 25 }),
  },
  {
    name: "get_plan_margins",
    title: "Margin per subscription plan",
    description: "AI cost, revenue and margin of each plan or product over a period. Needs the app's key.",
    inputSchema: { type: "object", properties: { days } },
    needsKey: true,
    run: (a, ctx) => readMetric(ctx.db(), ctx.appId!, "plans", { days: a.days }),
  },
  {
    name: "get_cost_breakdown",
    title: "AI cost by model and by feature",
    description: "The app's AI cost over a period split by model and by feature. Needs the app's key.",
    inputSchema: { type: "object", properties: { days } },
    needsKey: true,
    run: (a, ctx) => readMetric(ctx.db(), ctx.appId!, "breakdown", { days: a.days }),
  },
];

const describe = (t: Tool) => ({
  name: t.name,
  title: t.title,
  description: t.description,
  inputSchema: t.inputSchema,
  annotations: { title: t.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
});

const toolText = (value: unknown, isError = false) => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  ...(isError ? { isError: true } : {}),
});

const NO_KEY =
  'This tool reads one app\'s data and needs that app\'s key. Add the header "Authorization: Bearer <ingest key>" to this MCP server\'s settings (the key starts with fsk_ and is in the FiscaLLM dashboard under Settings), then call the tool again. The price and estimate tools work without a key.';

export function mcpRoute(getDb: () => AnyDb) {
  const route = new Hono();
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, accept, mcp-protocol-version, mcp-session-id",
  };
  route.use("*", async (c, next) => {
    await next();
    for (const [k, v] of Object.entries(cors)) c.header(k, v);
  });
  route.options("/", (c) => c.body(null, 204));
  // No server-to-client stream and no sessions to end.
  route.get("/", (c) => c.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Method not allowed: POST JSON-RPC messages to this URL." } }, 405, { allow: "POST" }));
  route.delete("/", (c) => c.body(null, 405, { allow: "POST" }));

  route.post("/", async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const fail = (id: unknown, code: number, message: string, status: 200 | 400 = 200) =>
      c.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, status);
    if (!body || typeof body !== "object") return fail(null, -32700, "Parse error: send one JSON-RPC message", 400);
    if (Array.isArray(body)) return fail(null, -32600, "Batches are not supported: send one message per request", 400);

    const msg = body as { id?: unknown; method?: unknown; params?: Json };
    // A notification or a response from the client: nothing to answer.
    if (typeof msg.method !== "string" || msg.id === undefined || msg.id === null) return c.body(null, 202);
    const ok = (result: unknown) => c.json({ jsonrpc: "2.0", id: msg.id, result });

    switch (msg.method) {
      case "initialize": {
        const asked = msg.params?.protocolVersion;
        return ok({
          protocolVersion: typeof asked === "string" && PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER,
          instructions: INSTRUCTIONS,
        });
      }
      case "ping":
        return ok({});
      case "tools/list":
        return ok({ tools: TOOLS.map(describe) });
      case "resources/list":
        return ok({ resources: [] });
      case "resources/templates/list":
        return ok({ resourceTemplates: [] });
      case "prompts/list":
        return ok({ prompts: [] });
      case "tools/call": {
        const tool = TOOLS.find((t) => t.name === msg.params?.name);
        if (!tool) return fail(msg.id, -32602, `Unknown tool: ${String(msg.params?.name)}`);
        const args = (msg.params?.arguments && typeof msg.params.arguments === "object" ? msg.params.arguments : {}) as Args;
        // A misnamed argument would otherwise be read as 0 and give a wrong answer.
        const required: string[] = (tool.inputSchema as { required?: string[] }).required ?? [];
        const missing = required.filter((name) => args[name] === undefined || args[name] === null);
        if (missing.length) return ok(toolText(`Missing argument: ${missing.join(", ")}. Arguments are ${Object.keys(tool.inputSchema.properties ?? {}).join(", ")}.`, true));
        try {
          let appId: string | undefined;
          if (tool.needsKey) {
            const key = bearer(c.req.header("authorization"));
            if (!key) return ok(toolText(NO_KEY, true));
            appId = (await appForKey(getDb(), key))?.id;
            if (!appId) return ok(toolText("That key is not valid. Copy the ingest key again from the FiscaLLM dashboard (Settings).", true));
          }
          return ok(toolText(await tool.run(args, { db: getDb, appId })));
        } catch (e) {
          if (e instanceof ToolError) return ok(toolText(e.message, true));
          console.error("mcp tool failed", tool.name, e);
          return ok(toolText("The tool failed on FiscaLLM's side. Try again.", true));
        }
      }
      default:
        return fail(msg.id, -32601, `Method not found: ${msg.method}`);
    }
  });

  return route;
}
