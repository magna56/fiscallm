import { authorizeUrl, newAuthorization, oauthClient, redirectUri } from "@fiscallm/shared/rc-oauth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireApp } from "@/lib/auth";
import { publicUrl, RC_OAUTH_COOKIE } from "@/lib/revenuecat";

/** Step 1 of "Connect RevenueCat": send the owner to RevenueCat to approve. */
export async function GET(_req: Request, { params }: RouteContext<"/dashboard/[appId]/revenuecat/connect">) {
  const app = await requireApp((await params).appId);
  const base = await publicUrl();
  const client = oauthClient();
  if (!client) {
    return NextResponse.redirect(`${base}/dashboard/${app.id}/setup?error=${encodeURIComponent("Connect RevenueCat is not configured on this server")}#revenue`);
  }
  const { state, verifier, challenge } = await newAuthorization();
  // Ties the callback to this browser and app; RevenueCat's redirect is a
  // top-level GET, so a Lax cookie comes back with it.
  (await cookies()).set(RC_OAUTH_COOKIE, JSON.stringify({ appId: app.id, state, verifier }), {
    httpOnly: true,
    secure: base.startsWith("https"),
    sameSite: "lax",
    path: "/dashboard/connect/revenuecat",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizeUrl(client, redirectUri(base), state, challenge));
}
