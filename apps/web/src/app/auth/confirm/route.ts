import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["magiclink", "signup", "email", "recovery", "invite", "email_change"];

/**
 * Sign-in links point here, on our own domain, instead of at Supabase. It
 * works in any browser (no PKCE cookie from the tab that asked for the link)
 * and looks right next to a fiscallm.com sender.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}/dashboard`);
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Sign-in link is invalid or expired")}`);
}
