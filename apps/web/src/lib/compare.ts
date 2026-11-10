// Public facts about tools people compare FiscaLLM with, as checked on
// CHECKED. Keep it factual and dated; fix anything a vendor reports as wrong.

export const CHECKED = "2026-11-02";

export interface Competitor {
  slug: string;
  name: string;
  url: string;
  kind: string;
  pricing: string;
  hosting: string;
  openSource: string;
  revenue: string;
  /** What it does with Stripe. */
  stripe: string;
  strengths: string[];
  /** When this one is the better choice, said plainly. */
  pickThemIf: string;
  /** How to run both, when FiscaLLM can take usage from this tool's setup. */
  together?: { text: string; href: string; label: string };
  /** Set when this entry was checked on a different day than CHECKED. */
  checked?: string;
}

export const FISCALLM = {
  pricing: "Free. Hosted with fair use (100,000 events per app per month), or self-hosted with no limit",
  hosting: "Hosted or self-hosted",
  openSource: "Yes, MIT (server, dashboard and SDKs)",
  revenue: "Real revenue from RevenueCat (one-click connect and import), Stripe (webhook and 12-month import), CSV upload, or a revenue API",
  stripe: "Per end user: payments, trials, cancellations, refunds and lost disputes from a webhook, 12 months of history, Stripe's exact fee and any currency with a read-only key",
};

export const COMPETITORS: Competitor[] = [
  {
    slug: "weckr",
    name: "Weckr",
    url: "https://useweckr.com",
    kind: "Hosted AI cost tracking per user with spending caps and runaway-loop alerts",
    pricing: "Hobby free (50,000 requests a month), Pro $49 a month (1M requests a month)",
    hosting: "Hosted",
    openSource: "SDKs are MIT; the service is hosted",
    revenue: "Margin uses plan prices you set in the SDK; its site does not mention importing payments from Stripe or RevenueCat",
    stripe: "Not mentioned on its site",
    strengths: ["Spending caps that block or downgrade to a cheaper model", "Runaway-loop detection with Slack alerts", "MCP server and integration guides for LangChain, CrewAI and the Vercel AI SDK"],
    pickThemIf: "you want a hosted product and are happy to estimate revenue from plan prices rather than real payments.",
  },
  {
    slug: "margindash",
    name: "MarginDash",
    url: "https://margindash.com",
    kind: "Hosted per-customer, per-feature and per-model AI cost tracking tied to Stripe revenue",
    pricing: "Hosted plans; see its pricing page",
    hosting: "Hosted",
    openSource: "No",
    revenue: "Stripe, or revenue events sent through its SDK",
    stripe: "Stripe connection with a per-customer P&L",
    strengths: ["Stripe connection with a per-customer P&L", "Per-feature and per-model breakdown", "A simulator that shows savings from swapping a feature's model"],
    pickThemIf: "you bill through Stripe and want a hosted product with a model-swap simulator.",
  },
  {
    slug: "marginmeter",
    name: "MarginMeter",
    url: "https://marginmeter.app",
    kind: "Hosted SaaS gross-margin tracking: AI spend by provider, model and project against Stripe revenue",
    pricing: "See its site",
    hosting: "Hosted",
    openSource: "Not stated",
    revenue: "Stripe balance transactions, net of refunds, disputes and tax, through a read-only key",
    stripe: "Read-only key; company-level margin from balance transactions, net of refunds, disputes and tax",
    strengths: ["Net revenue from Stripe balance transactions", "Budgets, spend-anomaly and margin-floor alerts", "Cost by provider, model and project"],
    pickThemIf: "you want company-level gross margin across AI providers from Stripe, rather than margin per end user.",
  },
  {
    slug: "langfuse",
    name: "Langfuse",
    url: "https://langfuse.com",
    kind: "Open-source LLM observability: traces, evals, prompt management and cost tracking",
    pricing: "Free self-hosted; hosted plans with a free tier",
    hosting: "Hosted or self-hosted",
    openSource: "Yes",
    revenue: "Tracks cost per user ID, but does not import subscription revenue to compute margin",
    stripe: "No",
    strengths: ["Full traces of prompts and responses for debugging", "Evals and prompt management", "Large community"],
    pickThemIf: "you need tracing, evals and prompt debugging. Many teams use it alongside FiscaLLM, which adds revenue and margin.",
    together: {
      text: "If your traces reach Langfuse through OpenTelemetry, add FiscaLLM as a second OTLP exporter. The same spans then give you cost per user next to revenue, with no second SDK.",
      href: "/integrations/opentelemetry",
      label: "OpenTelemetry setup",
    },
  },
  {
    slug: "helicone",
    name: "Helicone",
    url: "https://helicone.ai",
    kind: "Open-source LLM observability through a gateway or proxy",
    pricing: "Free tier; paid hosted plans",
    hosting: "Hosted or self-hosted",
    openSource: "Yes",
    revenue: "Tracks cost per user through request headers, but does not import subscription revenue to compute margin",
    stripe: "No",
    strengths: ["Gateway with caching, retries and rate limits", "Request logging and dashboards", "One-line proxy setup"],
    pickThemIf: "you want a gateway in front of your AI provider with logging and caching. FiscaLLM needs no proxy and adds revenue and margin per user.",
  },
  {
    slug: "litellm",
    name: "LiteLLM",
    url: "https://docs.litellm.ai/docs/proxy/cost_tracking",
    kind: "Open-source LLM gateway (proxy) that calls 100+ providers through one API and logs spend per key, user, team and end customer",
    pricing: "Free self-hosted; Enterprise license (SSO, audit logs, spend reports) through sales",
    hosting: "Self-hosted proxy",
    openSource: "Yes, MIT core; Enterprise features need a license",
    revenue: "Tracks spend per end customer, but does not import subscription revenue to compute margin",
    stripe: "No",
    strengths: ["One OpenAI-style API for 100+ providers", "Spend logs per key, user, team and end customer", "Per-customer budgets and rate limits on the proxy"],
    pickThemIf: "you want one gateway for many providers with budgets enforced at the proxy. FiscaLLM needs no proxy and puts each user's cost next to what they paid.",
    together: {
      text: "Keep the proxy and add one callback to its config. LiteLLM sends each request's cost to FiscaLLM, which puts it next to what that user paid.",
      href: "/integrations/litellm",
      label: "LiteLLM setup",
    },
    checked: "2026-11-08",
  },
  {
    slug: "portkey",
    name: "Portkey",
    url: "https://portkey.ai/pricing",
    kind: "AI gateway with observability, guardrails, prompt management and budgets on virtual keys",
    pricing: "Developer free (10k logs a month), Production $49 a month (100k logs), Enterprise custom",
    hosting: "Hosted; the open-source gateway can be self-hosted; Enterprise adds VPC",
    openSource: "The gateway is MIT; the hosted platform is not",
    revenue: "Logs cost with custom metadata such as user, but does not import subscription revenue to compute margin",
    stripe: "No",
    strengths: ["Routing, retries, fallbacks and load balancing across providers", "Guardrails and prompt management", "Budgets and rate limits on virtual keys"],
    pickThemIf: "you want a hosted AI gateway with guardrails and routing. FiscaLLM needs no gateway and adds revenue and margin per user.",
    checked: "2026-11-08",
  },
  {
    slug: "openmeter",
    name: "OpenMeter",
    url: "https://openmeter.io",
    kind: "Open-source usage metering and billing (now part of Kong): meters events such as tokens per customer and bills for them",
    pricing: "Free self-hosted; hosted through Kong Konnect, see its pricing",
    hosting: "Hosted or self-hosted",
    openSource: "Yes, Apache 2.0",
    revenue: "Turns usage into invoices for your customers; does not compare your AI cost with what each customer paid",
    stripe: "Syncs usage to Stripe to create invoices",
    strengths: ["Real-time usage metering at scale", "Usage limits and entitlements", "Usage-based invoicing through Stripe"],
    pickThemIf: "you want to charge customers per token or per use. FiscaLLM is for the other side: whether what they pay covers what they cost you. They work well together.",
    checked: "2026-11-08",
  },
];

export const findCompetitor = (slug: string) => COMPETITORS.find((c) => c.slug === slug);
