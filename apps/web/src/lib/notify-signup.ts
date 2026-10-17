import { CONTACT } from "@/components/site";

export interface NewSignup {
  email: string | null;
  fullName: string;
  company: string;
  website: string | null;
  role: string | null;
  teamSize: string | null;
  /** How many accounts exist now, this one included. */
  total: number;
}

/**
 * Tells the founder by email when someone finishes signing up. Never throws:
 * a failed notification must not get in the way of a new user.
 */
export async function notifyNewSignup(s: NewSignup): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const to = process.env.SIGNUP_NOTIFY_EMAIL ?? CONTACT;
  const lines = [
    `${s.fullName} from ${s.company} just signed up (account #${s.total}).`,
    "",
    `Email:     ${s.email ?? "unknown"}`,
    `Company:   ${s.company}`,
    `Website:   ${s.website ?? "-"}`,
    `Role:      ${s.role ?? "-"}`,
    `Team size: ${s.teamSize ?? "-"}`,
    "",
    "Reply to this email to reach them.",
  ];
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: "FiscaLLM <alerts@fiscallm.com>",
        to: [to],
        ...(s.email ? { reply_to: s.email } : {}),
        subject: `New signup: ${s.company} (${s.fullName})`,
        text: lines.join("\n"),
      }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    // ignored on purpose
  }
}
