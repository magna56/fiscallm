import { sql } from "drizzle-orm";
import type { MetricsDb } from "../metrics";
import { buildWeeklyReport, renderWeeklyReport } from "./index";
import { unsubscribeToken } from "./sign";

export const REPORT_FROM = process.env.EMAIL_FROM_REPORTS ?? "FiscaLLM <reports@fiscallm.com>";

export interface ReportApp {
  id: string;
  name: string;
}

export interface SendConfig {
  resendApiKey: string;
  /** Signs unsubscribe links. */
  signingSecret: string;
  /** Public site, e.g. https://fiscallm.com */
  baseUrl: string;
}

/** The owner's sign-in email, from Supabase Auth in the same database. */
export async function ownerEmail(db: MetricsDb, ownerId: string): Promise<string | null> {
  const res = (await db.execute(sql`SELECT email FROM auth.users WHERE id = ${ownerId}::uuid`)) as unknown;
  const rows = (Array.isArray(res) ? res : (res as { rows: { email: string }[] }).rows) as { email: string | null }[];
  return rows[0]?.email ?? null;
}

export type SendResult = "sent" | "no-activity" | { error: string };

export async function sendWeeklyReport(
  db: MetricsDb,
  app: ReportApp,
  to: string,
  config: SendConfig,
  now = new Date(),
): Promise<SendResult> {
  const report = await buildWeeklyReport(db, app.id, now);
  if (!report) return "no-activity";

  const token = await unsubscribeToken(config.signingSecret, app.id);
  const unsubscribeUrl = `${config.baseUrl}/api/unsubscribe?app=${app.id}&t=${token}`;
  const email = renderWeeklyReport(report, {
    appName: app.name,
    dashboardUrl: `${config.baseUrl}/dashboard/${app.id}`,
    unsubscribeUrl,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${config.resendApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: REPORT_FROM,
      to: [to],
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return { error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
  return "sent";
}
