// The catalog of sources: every tool FiscaLLM can read AI spend from. The
// dashboard's Sources page, the integrations pages and llms.txt are built
// from it. The code that reads each source is in apps/api/src/sources, one
// file per tool; `id` here is what that file registers and what is stored in
// ai_events.source.

/**
 * How usage arrives:
 * - "otel": the tool exports each model call itself (OpenTelemetry logs).
 * - "pull": FiscaLLM reads the provider's usage API with a read-only key.
 * - "code": one call from the customer's backend (SDK, traces, or a proxy).
 * - "planned": not built yet.
 */
export type SourceKind = "otel" | "pull" | "code" | "planned";
export type SourceGroup = "agents" | "providers" | "code";

export const SOURCE_GROUPS: Record<SourceGroup, { title: string; blurb: string }> = {
  agents: { title: "Coding agents", blurb: "What each developer spends, read from the tool itself. No proxy, and prompts are never stored." },
  providers: { title: "AI providers", blurb: "Usage of a whole organization, read once a day with a read-only admin key." },
  code: { title: "Your own product", blurb: "AI calls your backend makes, reported per end user with one line after each call." },
};

export interface Snippet {
  /** Where the text goes: a file path, or a short label. */
  where: string;
  code: string;
}

export interface SourceKey {
  label: string;
  placeholder: string;
  /** A source of a RegExp the pasted key must match. */
  pattern: string;
  /** Where to create the key and what access it needs. */
  help: string;
  url: string;
}

export interface SourceInfo {
  id: string;
  name: string;
  group: SourceGroup;
  kind: SourceKind;
  /** One line: what shows up once it is on. */
  summary: string;
  /** Who the spend is attributed to. */
  user?: string;
  /** Where the dollar amount comes from. */
  cost?: string;
  /** Limits worth knowing before turning it on. */
  notes?: string[];
  /**
   * False until the source has been run against a live account. Every source
   * is tested with records in the tool's published format.
   */
  verifiedLive: boolean;
  /** For "code" sources: the provider value their events carry. */
  provider?: string;
  /** Settings to paste, with the ingest key and the server's address filled in. */
  setup?: (key: string, base: string) => Snippet[];
  key?: SourceKey;
  /** A page on the site about this source. */
  docs?: string;
  /** For planned sources: the issue to vote on. */
  issue?: string;
}

const NEW_ISSUE = "https://github.com/magna56/fiscallm/issues/new?labels=source&title=";

export const SOURCES: readonly SourceInfo[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    group: "agents",
    kind: "otel",
    summary: "Spend per developer and team, per model, from Claude Code's built-in OpenTelemetry export.",
    user: "The developer's account email; a team from OTEL_RESOURCE_ATTRIBUTES (team.id).",
    cost: "Claude Code's own estimate for each call, at API prices.",
    notes: ["On a subscription (Pro, Max, Team) the amount is what the usage would cost at API prices, not a bill.", "Not tested on Amazon Bedrock or Google Vertex AI."],
    verifiedLive: false,
    setup: (key, base) => [
      {
        where: "~/.claude/settings.json (or managed settings for the whole team)",
        code: `{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_LOGS_PROTOCOL": "http/json",
    "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT": "${base}/api/v1/otel/v1/logs",
    "OTEL_EXPORTER_OTLP_LOGS_HEADERS": "Authorization=Bearer ${key}"
  }
}`,
      },
    ],
    docs: "/integrations/claude-code",
  },
  {
    id: "codex",
    name: "Codex CLI",
    group: "agents",
    kind: "otel",
    summary: "Spend per developer and model, from the OpenTelemetry export built into OpenAI's Codex CLI.",
    user: "The signed-in ChatGPT account's email; with an API key, the machine's host name or fiscallm.user_id.",
    cost: "Tokens of each completed response, priced at OpenAI's API list prices.",
    notes: ["On a ChatGPT plan the amount is what the usage would cost at API prices, not a bill.", "Covers the CLI. Codex in the cloud and in the IDE are not tested."],
    verifiedLive: false,
    setup: (key, base) => [
      {
        where: "~/.codex/config.toml",
        code: `[otel.exporter.otlp-http]
endpoint = "${base}/api/v1/otel/v1/logs"
protocol = "json"

[otel.exporter.otlp-http.headers]
Authorization = "Bearer ${key}"`,
      },
    ],
    docs: "/integrations/codex",
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    group: "agents",
    kind: "otel",
    summary: "Spend per developer and model, from Gemini CLI's built-in OpenTelemetry export.",
    user: "The signed-in Google account's email; otherwise the CLI's install ID or fiscallm.user_id.",
    cost: "Tokens of each API response (thinking included), priced at Google's API list prices.",
    notes: ["With a free Google sign-in nothing is billed; the amount is what the usage would cost at API prices."],
    verifiedLive: false,
    setup: (key, base) => [
      {
        where: "~/.gemini/settings.json",
        code: `{
  "telemetry": {
    "enabled": true,
    "target": "local",
    "otlpProtocol": "http",
    "otlpEndpoint": "${base}/api/v1/otel",
    "otlpHeaders": { "Authorization": "Bearer ${key}" },
    "logPrompts": false
  }
}`,
      },
    ],
    docs: "/integrations/gemini-cli",
  },
  {
    id: "cursor",
    name: "Cursor",
    group: "agents",
    kind: "pull",
    summary: "Spend per team member and model, read from Cursor's Admin API.",
    user: "The team member's email.",
    cost: "What Cursor charged for each request; for requests covered by the plan, Cursor's model cost.",
    notes: ["Needs a Cursor team and an admin to create the key.", "Read once a day, and when you press Sync now. Cursor's own data is about an hour behind."],
    verifiedLive: false,
    key: {
      label: "Cursor Admin API key",
      placeholder: "key_…",
      pattern: "^[A-Za-z0-9_\\-]{20,200}$",
      help: "In Cursor: team Settings, Advanced, Admin API Keys, Create new API key. Only team admins can create one.",
      url: "https://cursor.com/dashboard",
    },
    docs: "/integrations/cursor",
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    group: "agents",
    kind: "planned",
    summary: "Premium request spend per developer.",
    verifiedLive: false,
    issue: `${NEW_ISSUE}GitHub%20Copilot`,
  },
  {
    id: "windsurf",
    name: "Windsurf",
    group: "agents",
    kind: "planned",
    summary: "Credit spend per developer.",
    verifiedLive: false,
    issue: `${NEW_ISSUE}Windsurf`,
  },
  {
    id: "openai",
    name: "OpenAI API",
    group: "providers",
    kind: "pull",
    summary: "Every OpenAI API call in the organization, per member or API key and per model: chat, embeddings, Whisper and other transcription, and text to speech.",
    user: "The organization member's email; for a service account, the API key ID.",
    cost: "Hourly token, audio-second and character counts, priced at OpenAI's API list prices.",
    notes: [
      "One row per member, model and hour, so the request count is lower than the real number of calls.",
      "Image generation is not read. Audio tokens in chat models are priced as text.",
      "If Codex CLI runs on an API key of the same organization and also exports to FiscaLLM, that usage is counted twice. Turn on one of the two.",
    ],
    verifiedLive: false,
    key: {
      label: "OpenAI admin key",
      placeholder: "sk-admin-…",
      pattern: "^sk-admin-[A-Za-z0-9_\\-]{20,300}$",
      help: "In the OpenAI Platform: Settings, Organization, Admin keys. Only organization owners can create one. It reads usage; FiscaLLM never calls a model with it.",
      url: "https://platform.openai.com/settings/organization/admin-keys",
    },
    docs: "/integrations/openai-usage",
  },
  {
    id: "anthropic",
    name: "Anthropic API",
    group: "providers",
    kind: "pull",
    summary: "Every Claude API call in the organization, per member or API key, model and product (Messages API, Claude Code, batches).",
    user: "The member's email; otherwise the API key or service account ID.",
    cost: "Hourly token counts, priced at Anthropic's API list prices.",
    notes: [
      "Anthropic's Admin API is not available on the claude.ai Team plan or to individual Console accounts. For those, use the Claude Code export above.",
      "One row per member, model, product and hour, so the request count is lower than the real number of calls.",
      "Claude Code usage is skipped here when the Claude Code export is already sending it, so it is not counted twice.",
      "Anthropic's numbers lag about 4 hours. One-hour cache writes are priced as five-minute ones.",
    ],
    verifiedLive: false,
    key: {
      label: "Anthropic Admin API key",
      placeholder: "sk-ant-admin01-…",
      pattern: "^sk-ant-admin[A-Za-z0-9_\\-]{20,300}$",
      help: "In the Claude Console: Settings, Admin keys. Only organization admins can create one. It reads usage; FiscaLLM never calls a model with it.",
      url: "https://platform.claude.com/settings/admin-keys",
    },
    docs: "/integrations/anthropic-usage",
  },
  {
    id: "sdk",
    name: "FiscaLLM SDK",
    group: "code",
    kind: "code",
    summary: "One line after each AI call in your backend (TypeScript or Python): OpenAI, Anthropic, Gemini and any other provider, per end user.",
    cost: "Tokens priced from the built-in table, or the exact cost you pass.",
    verifiedLive: true,
    setup: (key, base) => [
      {
        where: "TypeScript (npm install fiscallm)",
        code: `import { Meter } from "fiscallm";

// FISCALLM_KEY=${key}
const meter = new Meter({ apiKey: process.env.FISCALLM_KEY!${base === "https://fiscallm.com" ? "" : `, endpoint: "${base}/api/v1/events"`} });

const res = await openai.chat.completions.create({ model, messages });
meter.trackOpenAI(res, { userId, feature: "chat" });`,
      },
    ],
    docs: "/docs",
  },
  {
    id: "otel",
    name: "OpenTelemetry traces",
    group: "code",
    kind: "code",
    summary: "AI call spans in the GenAI conventions (Vercel AI SDK, OpenLLMetry, OpenInference), with a user.id attribute.",
    cost: "Tokens priced from the built-in table, or the cost on the span.",
    verifiedLive: true,
    setup: (key, base) => [
      {
        where: "Environment of your service",
        code: `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=${base}/api/v1/otel/v1/traces
OTEL_EXPORTER_OTLP_TRACES_HEADERS=Authorization=Bearer%20${key}`,
      },
    ],
    docs: "/integrations/opentelemetry",
  },
  {
    id: "litellm",
    name: "LiteLLM",
    group: "code",
    kind: "code",
    summary: "One callback in the LiteLLM proxy; every model behind it, with LiteLLM's own cost.",
    cost: "The cost LiteLLM computed for the call.",
    verifiedLive: true,
    setup: (key, base) => [
      {
        where: "LiteLLM config.yaml",
        code: `# FISCALLM_KEY=${key} in the proxy's environment
litellm_settings:
  callbacks: ["fiscallm"]

callback_settings:
  fiscallm:
    callback_type: generic_api
    endpoint: ${base}/api/v1/litellm
    headers:
      Authorization: os.environ/FISCALLM_KEY`,
      },
    ],
    docs: "/integrations/litellm",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    group: "code",
    kind: "code",
    provider: "elevenlabs",
    summary: "Text to speech and voice calls per end user: report the characters and what the call cost you.",
    cost: "The cost you pass. ElevenLabs bills in credits whose price depends on your plan, so there is no list price to apply.",
    verifiedLive: false,
    setup: (key) => [
      {
        where: "After each ElevenLabs call (TypeScript)",
        code: `// FISCALLM_KEY=${key}
const audio = await elevenlabs.textToSpeech.convert(voiceId, { text, modelId });
meter.track({
  userId,
  provider: "elevenlabs",
  model: modelId,
  units: text.length,
  unit: "character",
  costUsd: text.length * YOUR_PRICE_PER_CHARACTER,
  feature: "voice",
});`,
      },
    ],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    group: "code",
    kind: "code",
    provider: "perplexity",
    summary: "Sonar API calls per end user, with the cost Perplexity returns on each response.",
    cost: "usage.cost.total_cost from the response (tokens plus the search fee).",
    verifiedLive: false,
    setup: (key) => [
      {
        where: "After each Perplexity call (TypeScript)",
        code: `// FISCALLM_KEY=${key}
const res = await perplexity.chat.completions.create({ model: "sonar", messages });
meter.track({
  userId,
  provider: "perplexity",
  model: res.model,
  inputTokens: res.usage.prompt_tokens,
  outputTokens: res.usage.completion_tokens,
  costUsd: res.usage.cost?.total_cost,
  feature: "search",
});`,
      },
    ],
  },
  {
    id: "whisper",
    name: "Whisper and transcription",
    group: "code",
    kind: "code",
    summary: "Minutes of audio per end user. For a whole organization, the OpenAI API source above reads them with no code.",
    cost: "Minutes priced from the built-in table (whisper-1 and the gpt-4o transcribe models).",
    verifiedLive: true,
    setup: (key) => [
      {
        where: "After each transcription (TypeScript)",
        code: `// FISCALLM_KEY=${key}
const res = await openai.audio.transcriptions.create({ model: "whisper-1", file });
meter.track({
  userId,
  provider: "openai",
  model: "whisper-1",
  units: audioSeconds / 60,
  unit: "minute",
  feature: "transcribe",
});`,
      },
    ],
  },
];

const BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

export const sourceInfo = (id: string): SourceInfo | undefined => BY_ID.get(id);

/** What to call a value of ai_events.source; an unknown id is shown as it is. */
export const sourceName = (id: string | null | undefined): string => (id ? (BY_ID.get(id)?.name ?? id) : "SDK and API");
