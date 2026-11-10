// OpenAPI description of the public HTTP API, for API clients, code
// generators and AI agents that read /openapi.json.

const ok = (description: string, schema: object = { type: "object" }) => ({
  description,
  content: { "application/json": { schema } },
});
const error = (description: string) => ok(description, { $ref: "#/components/schemas/Error" });
const query = (name: string, description: string, schema: object = { type: "integer", minimum: 0 }, required = false) => ({
  name,
  in: "query",
  required,
  description,
  schema,
});
const days = query("days", "How many days back to look, counting today.", { type: "integer", minimum: 1, maximum: 365, default: 30 });
const keyed = { security: [{ ingestKey: [] }] };
const money = { type: "number", description: "USD" };

const SPEC = {
  openapi: "3.1.0",
  info: {
    title: "FiscaLLM API",
    version: "1.0.0",
    summary: "LLM prices, cost estimates, and AI cost and margin per user.",
    description:
      "FiscaLLM shows what each user of an AI app costs in AI next to what that user pays. The price endpoints are public. Sending usage and reading margins need an app's ingest key. An MCP server with the same data is at https://fiscallm.com/api/mcp.",
    license: { name: "MIT", identifier: "MIT" },
    contact: { name: "FiscaLLM", url: "https://github.com/magna56/fiscallm/issues" },
  },
  externalDocs: { description: "Docs", url: "https://fiscallm.com/docs" },
  servers: [{ url: "https://fiscallm.com/api" }],
  tags: [
    { name: "Prices", description: "Public. No key. CORS enabled." },
    { name: "Usage", description: "Send AI usage. Needs the app's ingest key." },
    { name: "Margins", description: "Read cost, revenue and margin. Needs the app's ingest key." },
  ],
  paths: {
    "/v1/prices": {
      get: {
        tags: ["Prices"],
        operationId: "listPrices",
        summary: "Current list prices of LLM models",
        parameters: [
          query("provider", "Only this provider's models.", { type: "string", enum: ["openai", "anthropic", "google"] }),
          query("q", "Only models whose ID contains this text.", { type: "string" }),
        ],
        responses: {
          "200": ok("Prices in USD per million tokens.", {
            type: "object",
            properties: {
              currency: { type: "string" },
              unit: { type: "string" },
              tier: { type: "string" },
              checked: { type: "string", format: "date", description: "When the table was last checked against the providers' pricing pages." },
              count: { type: "integer" },
              models: { type: "array", items: { $ref: "#/components/schemas/ModelPrice" } },
            },
          }),
        },
      },
    },
    "/v1/prices/{model}": {
      get: {
        tags: ["Prices"],
        operationId: "getPrice",
        summary: "Current list price of one model",
        parameters: [{ name: "model", in: "path", required: true, description: 'Model ID, e.g. "gpt-4o-mini". Dated IDs and provider prefixes resolve.', schema: { type: "string" } }],
        responses: {
          "200": ok("The model's price.", { type: "object", properties: { checked: { type: "string", format: "date" }, model: { $ref: "#/components/schemas/ModelPrice" } } }),
          "404": error("Unknown model."),
        },
      },
    },
    "/v1/estimate": {
      get: {
        tags: ["Prices"],
        operationId: "estimateCost",
        summary: "USD cost of a call from its token counts",
        parameters: [
          query("model", "Model ID.", { type: "string" }, true),
          query("input", "Prompt tokens per call, including any cached ones."),
          query("output", "Reply tokens per call."),
          query("cached", "How many of the prompt tokens are read from the prompt cache."),
          query("cache_write", "Prompt tokens written to the cache (Anthropic)."),
          query("calls", "Number of calls like this one.", { type: "integer", minimum: 1, default: 1 }),
        ],
        responses: {
          "200": ok("The estimate.", {
            type: "object",
            properties: {
              provider: { type: "string" },
              model: { type: "string" },
              costUsd: { ...money, description: "USD for one call." },
              calls: { type: "integer" },
              totalUsd: { ...money, description: "USD for all calls." },
              checked: { type: "string", format: "date" },
            },
          }),
          "400": error("A parameter is missing or not a number."),
          "404": error("Unknown model."),
        },
      },
    },
    "/v1/events": {
      post: {
        ...keyed,
        tags: ["Usage"],
        operationId: "sendEvents",
        summary: "Send AI usage events",
        description: "Up to 100 events per request. An event whose id was already received is ignored, so retrying is safe. Never send prompts or responses.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["events"], properties: { events: { type: "array", maxItems: 100, items: { $ref: "#/components/schemas/Event" } } } },
            },
          },
        },
        responses: {
          "202": ok("Stored.", { type: "object", properties: { accepted: { type: "integer" }, duplicates: { type: "integer" }, unpriced: { type: "integer" } } }),
          "401": error("Missing or invalid key."),
          "403": error("The app is over its monthly event limit."),
        },
      },
    },
    "/v1/otel/v1/traces": {
      post: {
        ...keyed,
        tags: ["Usage"],
        operationId: "sendOtlpTraces",
        summary: "Send OpenTelemetry traces (OTLP/HTTP)",
        description:
          'Point an OTLP/HTTP exporter at https://fiscallm.com/api/v1/otel. Spans that follow the GenAI semantic conventions become usage events; other spans are ignored. Set the "user.id" attribute. JSON or protobuf, gzip allowed. Guide: https://fiscallm.com/integrations/opentelemetry',
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } }, "application/x-protobuf": { schema: { type: "string", format: "binary" } } },
        },
        responses: {
          "200": ok("Stored. partialSuccess lists AI call spans that were skipped, for example for having no user ID.", {
            type: "object",
            properties: { partialSuccess: { type: "object", properties: { rejectedSpans: { type: "integer" }, errorMessage: { type: "string" } } } },
          }),
          "401": error("Missing or invalid key."),
        },
      },
    },
    "/v1/litellm": {
      post: {
        ...keyed,
        tags: ["Usage"],
        operationId: "sendLiteLlmLogs",
        summary: "Receive LiteLLM's generic_api logging callback",
        description:
          "LiteLLM posts its standard logging payload here after each request. The cost LiteLLM worked out is stored as is. Guide: https://fiscallm.com/integrations/litellm",
        requestBody: { required: true, content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } },
        responses: {
          "200": ok("Stored.", {
            type: "object",
            properties: {
              accepted: { type: "integer" },
              duplicates: { type: "integer" },
              skipped: { type: "object", properties: { failedRequests: { type: "integer" }, noUser: { type: "integer" }, badTime: { type: "integer" } } },
            },
          }),
          "401": error("Missing or invalid key."),
        },
      },
    },
    "/v1/metrics/overview": {
      get: {
        ...keyed,
        tags: ["Margins"],
        operationId: "getMarginOverview",
        summary: "AI cost, revenue and margin of the app over a period",
        parameters: [days],
        responses: {
          "200": ok("Totals and a daily series.", {
            type: "object",
            properties: {
              days: { type: "integer" },
              costUsd: money,
              revenueUsd: money,
              marginUsd: money,
              costShare: { type: ["number", "null"], description: "AI cost divided by revenue." },
              requests: { type: "integer" },
              unmatchedCostUsd: { ...money, description: "Cost of users with no revenue record." },
            },
          }),
          "401": error("Missing or invalid key."),
        },
      },
    },
    "/v1/metrics/users": {
      get: {
        ...keyed,
        tags: ["Margins"],
        operationId: "listUsersByMargin",
        summary: "Each user's AI cost, revenue and margin, worst margin first",
        parameters: [
          days,
          query("limit", "How many users to return.", { type: "integer", minimum: 1, maximum: 500, default: 50 }),
          query("losing", "Only users whose AI cost is above their revenue.", { type: "boolean", default: false }),
        ],
        responses: {
          "200": ok("Users.", {
            type: "object",
            properties: {
              days: { type: "integer" },
              users: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    userId: { type: "string" },
                    state: { type: ["string", "null"] },
                    productId: { type: ["string", "null"] },
                    costUsd: money,
                    revenueUsd: money,
                    marginUsd: money,
                    requests: { type: "integer" },
                  },
                },
              },
            },
          }),
          "401": error("Missing or invalid key."),
        },
      },
    },
    "/v1/metrics/plans": {
      get: {
        ...keyed,
        tags: ["Margins"],
        operationId: "getPlanMargins",
        summary: "AI cost, revenue and margin of each plan or product",
        parameters: [days],
        responses: {
          "200": ok("Plans.", {
            type: "object",
            properties: {
              days: { type: "integer" },
              plans: {
                type: "array",
                items: {
                  type: "object",
                  properties: { productId: { type: "string" }, users: { type: "integer" }, revenueUsd: money, costUsd: money, marginUsd: money, costShare: { type: ["number", "null"] } },
                },
              },
            },
          }),
          "401": error("Missing or invalid key."),
        },
      },
    },
    "/v1/metrics/breakdown": {
      get: {
        ...keyed,
        tags: ["Margins"],
        operationId: "getCostBreakdown",
        summary: "AI cost split by model and by feature",
        parameters: [days],
        responses: { "200": ok("Cost by model and by feature."), "401": error("Missing or invalid key.") },
      },
    },
  },
  components: {
    securitySchemes: {
      ingestKey: { type: "http", scheme: "bearer", description: "The app's ingest key, from the app's Setup page. Keep it on your backend." },
    },
    schemas: {
      Error: { type: "object", properties: { error: { type: "string" }, hint: { type: "string" } } },
      ModelPrice: {
        type: "object",
        required: ["id", "provider", "inputPerMtok", "outputPerMtok"],
        properties: {
          id: { type: "string" },
          provider: { type: "string" },
          inputPerMtok: { type: "number", description: "USD per million input tokens." },
          outputPerMtok: { type: "number", description: "USD per million output tokens." },
          cachedInputPerMtok: { type: "number", description: "USD per million input tokens read from the prompt cache." },
          cacheWritePerMtok: { type: "number", description: "USD per million input tokens written to the prompt cache." },
          longContext: { type: "object", description: "Rates that apply above a prompt size (overTokens)." },
          unitPrices: { type: "object", description: "Per image, second, minute or character, for media models." },
          next: { type: "object", description: "An announced price change, with effectiveFrom." },
          url: { type: "string", format: "uri" },
        },
      },
      Event: {
        type: "object",
        required: ["id", "userId", "ts", "provider", "model"],
        properties: {
          id: { type: "string", format: "uuid", description: "A UUID you generate. Retries reuse it." },
          userId: { type: "string", description: "The same ID your billing has for this user." },
          ts: { type: "string", format: "date-time", description: "Up to 90 days old." },
          provider: { type: "string" },
          model: { type: "string" },
          inputTokens: { type: "integer", description: "Excluding cache reads and writes." },
          outputTokens: { type: "integer" },
          cachedTokens: { type: "integer" },
          cacheWriteTokens: { type: "integer" },
          costUsd: { type: "number", description: "Optional exact cost. Overrides the price table." },
          feature: { type: "string" },
          jobId: { type: "string" },
        },
      },
    },
  },
};

export function GET() {
  return Response.json(SPEC, { headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=3600" } });
}
