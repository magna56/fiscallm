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
  strengths: string[];
  /** When this one is the better choice, said plainly. */
  pickThemIf: string;
}

export const FISCALLM = {
  pricing: "Free. Hosted with fair use (100,000 events per app per month), or self-hosted with no limit",
  hosting: "Hosted or self-hosted",
  openSource: "Yes, MIT (server, dashboard and SDKs)",
  revenue: "Real revenue from RevenueCat (one-click connect and import), Stripe (webhook and 12-month import, beta, USD), CSV upload, or a revenue API",
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
    strengths: ["Full traces of prompts and responses for debugging", "Evals and prompt management", "Large community"],
    pickThemIf: "you need tracing, evals and prompt debugging. Many teams use it alongside FiscaLLM, which adds revenue and margin.",
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
    strengths: ["Gateway with caching, retries and rate limits", "Request logging and dashboards", "One-line proxy setup"],
    pickThemIf: "you want a gateway in front of your AI provider with logging and caching. FiscaLLM needs no proxy and adds revenue and margin per user.",
  },
];

export const findCompetitor = (slug: string) => COMPETITORS.find((c) => c.slug === slug);
