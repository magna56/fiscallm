// "Connect RevenueCat": OAuth 2.0 against RevenueCat, so owners approve
// access instead of pasting a webhook secret and an API key.
// https://www.revenuecat.com/docs/projects/oauth-setup
//
// Only fiscallm.com has a registered client. Self-hosted copies without
// REVENUECAT_OAUTH_CLIENT_ID / _SECRET keep the manual setup.

import { eq } from "drizzle-orm";
import type { MetricsDb } from "./metrics";
import * as schema from "./schema";
import { open, seal } from "./secret-box";

const API = "https://api.revenuecat.com";

export const RC_OAUTH_SCOPES = [
  "project_configuration:projects:read",
  "project_configuration:integrations:read_write",
  "customer_information:customers:read",
  "customer_information:subscriptions:read",
  "customer_information:purchases:read",
];

/** Stored as an import's key when the import authenticates with the connection. */
export const OAUTH_IMPORT_KEY = "oauth:connection";

// Refresh this long before the hour-long access token runs out.
const REFRESH_MARGIN_MS = 5 * 60_000;

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

export function oauthClient(env: Record<string, string | undefined> = process.env): OAuthClient | null {
  const clientId = env.REVENUECAT_OAUTH_CLIENT_ID;
  const clientSecret = env.REVENUECAT_OAUTH_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Must match a redirect URI registered with RevenueCat exactly. */
export function redirectUri(publicUrl: string) {
  return `${publicUrl.replace(/\/$/, "")}/api/oauth/revenuecat/callback`;
}

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** A random state and a PKCE verifier with its S256 challenge. */
export async function newAuthorization() {
  const state = b64url(crypto.getRandomValues(new Uint8Array(24)));
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  return { state, verifier, challenge };
}

export function authorizeUrl(client: OAuthClient, redirect: string, state: string, challenge: string) {
  const q = new URLSearchParams({
    client_id: client.clientId,
    response_type: "code",
    redirect_uri: redirect,
    scope: RC_OAUTH_SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${API}/oauth2/authorize?${q}`;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export class RcOAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function tokenRequest(client: OAuthClient, form: Record<string, string>, now = Date.now()): Promise<Tokens> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${btoa(`${client.clientId}:${client.clientSecret}`)}`,
    },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof data.access_token !== "string" || typeof data.refresh_token !== "string") {
    const reason = typeof data.error_description === "string" ? data.error_description : typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    throw new RcOAuthError(`RevenueCat token request failed: ${reason}`, res.status);
  }
  const ttl = typeof data.expires_in === "number" ? data.expires_in : 3600;
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: new Date(now + ttl * 1000) };
}

export function exchangeCode(client: OAuthClient, code: string, redirect: string, verifier: string) {
  return tokenRequest(client, { grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: verifier });
}

export function refreshTokens(client: OAuthClient, refreshToken: string) {
  return tokenRequest(client, { grant_type: "refresh_token", refresh_token: refreshToken });
}

/** Stores a fresh token pair for the app, creating the connection if needed. */
export async function saveTokens(db: MetricsDb, serverSecret: string, appId: string, t: Tokens) {
  const values = {
    accessTokenCipher: await seal(serverSecret, t.accessToken),
    refreshTokenCipher: await seal(serverSecret, t.refreshToken),
    accessExpiresAt: t.expiresAt,
    updatedAt: new Date(),
  };
  await db
    .insert(schema.rcConnections)
    .values({ appId, ...values })
    .onConflictDoUpdate({ target: schema.rcConnections.appId, set: values });
}

/**
 * A usable access token for the app's connection, refreshed when it is about
 * to expire. Null when the app is not connected.
 */
export async function accessToken(db: MetricsDb, serverSecret: string, client: OAuthClient, appId: string, now = Date.now()): Promise<string | null> {
  const [c] = await db.select().from(schema.rcConnections).where(eq(schema.rcConnections.appId, appId));
  if (!c) return null;
  if (c.accessExpiresAt.getTime() - now > REFRESH_MARGIN_MS) return open(serverSecret, c.accessTokenCipher);
  const fresh = await refreshTokens(client, await open(serverSecret, c.refreshTokenCipher));
  // Store right away: the old refresh token stops working 30 seconds from now.
  await saveTokens(db, serverSecret, appId, fresh);
  return fresh.accessToken;
}

async function api<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}/v2${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new RcOAuthError(body.message ?? `RevenueCat answered ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

export interface RcProject {
  id: string;
  name: string;
}

export async function listProjects(token: string): Promise<RcProject[]> {
  const out: RcProject[] = [];
  let path: string | null = "/projects?limit=100";
  while (path) {
    const page: { items: RcProject[]; next_page: string | null } = await api(token, path);
    out.push(...page.items.map((p) => ({ id: p.id, name: p.name })));
    path = page.next_page ? page.next_page.replace(/^.*\/v2/, "") : null;
  }
  return out;
}

interface Webhook {
  id: string;
  url: string;
}

/**
 * Points a RevenueCat webhook at FiscaLLM, for all apps and both
 * environments (sandbox only counts while the app is in test mode). Reuses
 * an existing FiscaLLM webhook for the same URL, so reconnecting never adds
 * a second one. Names must be unique in a project, and the owner may already
 * have a manual "FiscaLLM" webhook (or one per FiscaLLM app), so the name
 * carries the app. Returns the webhook integration id.
 */
export async function ensureWebhook(token: string, projectId: string, url: string, authorization: string, appName: string, appId: string): Promise<string> {
  const base = `/projects/${encodeURIComponent(projectId)}/integrations/webhooks`;
  const list: { items: Webhook[] } = await api(token, `${base}?limit=100`);
  const name = `FiscaLLM: ${appName.slice(0, 80)} (${appId.slice(0, 8)})`;
  const body = { name, url, authorization_header: authorization, environment: null, event_types: null };
  const existing = list.items.find((w) => w.url === url);
  if (existing) {
    await api(token, `${base}/${encodeURIComponent(existing.id)}`, { method: "POST", body: JSON.stringify(body) });
    return existing.id;
  }
  const created: Webhook = await api(token, base, { method: "POST", body: JSON.stringify(body) });
  return created.id;
}

export async function deleteWebhook(token: string, projectId: string, webhookId: string) {
  await api(token, `/projects/${encodeURIComponent(projectId)}/integrations/webhooks/${encodeURIComponent(webhookId)}`, { method: "DELETE" });
}
