import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { MetricsDb } from "./metrics";
import { accessToken, authorizeUrl, ensureWebhook, newAuthorization, oauthClient, redirectUri, saveTokens } from "./rc-oauth";
import * as schema from "./schema";
import { open } from "./secret-box";

const APP = "00000000-0000-4000-8000-000000000003";
const SECRET = "server-secret";
const client = { clientId: "cid", clientSecret: "csecret" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let db: MetricsDb;
beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
  db = pg as unknown as MetricsDb;
  await db.insert(schema.apps).values({ id: APP, name: "t", ownerId: APP, ingestKeyHash: "h3", rcWebhookSecret: "s" });
});
afterEach(() => vi.unstubAllGlobals());

describe("rc-oauth", () => {
  it("is off without both env vars", () => {
    expect(oauthClient({})).toBeNull();
    expect(oauthClient({ REVENUECAT_OAUTH_CLIENT_ID: "a" })).toBeNull();
    expect(oauthClient({ REVENUECAT_OAUTH_CLIENT_ID: "a", REVENUECAT_OAUTH_CLIENT_SECRET: "b" })).toEqual({ clientId: "a", clientSecret: "b" });
  });

  it("builds the authorize URL with PKCE S256 and the registered redirect", async () => {
    const { state, verifier, challenge } = await newAuthorization();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const url = new URL(authorizeUrl(client, redirectUri("https://fiscallm.com/"), state, challenge));
    expect(url.origin + url.pathname).toBe("https://api.revenuecat.com/oauth2/authorize");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "cid",
      response_type: "code",
      redirect_uri: "https://fiscallm.com/api/oauth/revenuecat/callback",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    expect(url.searchParams.get("scope")).toContain("project_configuration:integrations:read_write");
  });

  it("uses the stored token while fresh, and refreshes and stores the rotated pair near expiry", async () => {
    const now = Date.now();
    await saveTokens(db, SECRET, APP, { accessToken: "atk_old", refreshToken: "rtk_old", expiresAt: new Date(now + 3_600_000) });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await accessToken(db, SECRET, client, APP, now)).toBe("atk_old");
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(json({ access_token: "atk_new", refresh_token: "rtk_new", expires_in: 3600, token_type: "Bearer" }));
    expect(await accessToken(db, SECRET, client, APP, now + 3_400_000)).toBe("atk_new");
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({ authorization: `Basic ${btoa("cid:csecret")}` });
    expect(String((init as RequestInit).body)).toBe("grant_type=refresh_token&refresh_token=rtk_old");
    const [row] = await db.select().from(schema.rcConnections);
    expect(await open(SECRET, row!.refreshTokenCipher)).toBe("rtk_new");
  });

  it("returns null for an app that is not connected", async () => {
    expect(await accessToken(db, SECRET, client, "00000000-0000-4000-8000-0000000000ff")).toBeNull();
  });

  it("reuses FiscaLLM's webhook for the same URL instead of adding a second", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ items: [{ id: "wh_1", url: "https://fiscallm.com/api/webhooks/rc/x" }] }))
      .mockResolvedValueOnce(json({ id: "wh_1", url: "https://fiscallm.com/api/webhooks/rc/x" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await ensureWebhook("atk", "proj", "https://fiscallm.com/api/webhooks/rc/x", "s")).toBe("wh_1");
    expect(fetchMock.mock.calls[1]![0]).toBe("https://api.revenuecat.com/v2/projects/proj/integrations/webhooks/wh_1");

    fetchMock.mockReset()
      .mockResolvedValueOnce(json({ items: [] }))
      .mockResolvedValueOnce(json({ id: "wh_2", url: "https://fiscallm.com/api/webhooks/rc/x" }, 201));
    expect(await ensureWebhook("atk", "proj", "https://fiscallm.com/api/webhooks/rc/x", "s")).toBe("wh_2");
    expect(JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body))).toMatchObject({ name: "FiscaLLM", authorization_header: "s", environment: null });
  });
});
