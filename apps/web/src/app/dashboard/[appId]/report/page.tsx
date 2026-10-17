import { buildWeeklyReport, renderWeeklyReport } from "@fiscallm/shared/report";
import { Suspense } from "react";
import { Notice } from "@/components/ui";
import { requireApp } from "@/lib/auth";
import { metricsDb } from "@/lib/db";
import { origin } from "@/lib/origin";

export default function ReportPreviewPage({ params }: PageProps<"/dashboard/[appId]/report">) {
  return (
    <Suspense fallback={<p className="text-foreground/60">Loading…</p>}>
      <Preview params={params} />
    </Suspense>
  );
}

async function Preview({ params }: Pick<PageProps<"/dashboard/[appId]/report">, "params">) {
  const app = await requireApp((await params).appId);
  const report = await buildWeeklyReport(metricsDb(), app.id);
  if (!report) return <Notice>No activity in the last 7 days, so this week&apos;s email would not be sent.</Notice>;
  const base = await origin();
  const email = renderWeeklyReport(report, {
    appName: app.name,
    dashboardUrl: `${base}/dashboard/${app.id}`,
    unsubscribeUrl: `${base}/dashboard/${app.id}/settings`,
  });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        <span className="text-foreground/60">Subject:</span> {email.subject}
      </p>
      <iframe title="Weekly email preview" srcDoc={email.html} sandbox="" className="h-[900px] w-full rounded-lg border border-foreground/10 bg-white" />
    </div>
  );
}
