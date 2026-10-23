import { exchangeCode, listProjects, oauthClient, redirectUri, saveTokens } from "@fiscallm/shared/rc-oauth";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { requireApp } from "@/lib/auth";
import { metricsDb } from "@/lib/db";
import { connectProject, publicUrl, RC_OAUTH_COOKIE } from "@/lib/revenuecat";

/**
 * Step 2 of "Connect RevenueCat". RevenueCat redirects to
 * /api/oauth/revenuecat/callback, which forwards here with ?code&state.
 */
export async function GET(req: NextRequest) {
  const base = await publicUrl();
  const jar = await cookies();
  const raw = jar.get(RC_OAUTH_COOKIE)?.value;
  jar.delete({ name: RC_OAUTH_COOKIE, path: "/dashboard/connect/revenuecat" });

  let pending: { appId: string; state: string; verifier: string } | null = null;
  try {
    pending = raw ? JSON.parse(raw) : null;
  } catch {}
  if (!pending) return NextResponse.redirect(`${base}/dashboard?error=${encodeURIComponent("The RevenueCat connection expired; start it again from Setup.")}`);

  const app = await requireApp(pending.appId);
  const setup = `${base}/dashboard/${app.id}/setup`;
  const fail = (msg: string) => NextResponse.redirect(`${setup}?error=${encodeURIComponent(msg)}#revenue`);

  const q = req.nextUrl.searchParams;
  if (q.get("state") !== pending.state) return fail("The RevenueCat connection could not be verified; start it again.");
  if (q.get("error")) return fail(q.get("error") === "access_denied" ? "RevenueCat access was not approved." : `RevenueCat: ${q.get("error_description") ?? q.get("error")}`);
  const code = q.get("code");
  const client = oauthClient();
  const secret = process.env.CRON_SECRET;
  if (!code || !client || !secret) return fail("Connect RevenueCat is not configured on this server.");

  try {
    const tokens = await exchangeCode(client, code, redirectUri(base), pending.verifier);
    await saveTokens(metricsDb(), secret, app.id, tokens);
    const projects = await listProjects(tokens.accessToken);
    if (projects.length === 0) return fail("Your RevenueCat account has no projects yet.");
    // Several projects: the Setup page asks which one.
    if (projects.length > 1) return NextResponse.redirect(`${setup}#revenue`);
    await connectProject(app, tokens.accessToken, projects[0]!);
  } catch (e) {
    return fail(`Could not connect RevenueCat: ${(e as Error).message}`);
  }
  return NextResponse.redirect(`${setup}?done=${encodeURIComponent("RevenueCat connected. The webhook is set up and past subscribers are importing.")}#revenue`);
}
