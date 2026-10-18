import { trialCohorts, type TrialCohort } from "@fiscallm/shared/metrics";
import { Suspense } from "react";
import { DownloadCsv } from "@/components/download-csv";
import { Table } from "@/components/table";
import { Card, pct, usd, PageHeader } from "@/components/ui";
import { requireApp } from "@/lib/auth";
import { metricsDb } from "@/lib/db";

export default function TrialsPage(props: PageProps<"/dashboard/[appId]/trials">) {
  return (
    <Suspense fallback={<p className="text-foreground/60">Loading…</p>}>
      <Trials {...props} />
    </Suspense>
  );
}

async function Trials({ params }: Pick<PageProps<"/dashboard/[appId]/trials">, "params">) {
  const app = await requireApp((await params).appId);
  const rows = await trialCohorts(metricsDb(), app.id, { weeks: 12 });

  return (
    <>
    <PageHeader title="Trials" subtitle="What free trials cost you, by start week." />
    <Card title="Trial cohorts by start week (last 12 weeks)" action={<DownloadCsv href={`/dashboard/${app.id}/export/trials`} />}>
      <Table<TrialCohort>
        rows={rows}
        rowKey={(r) => r.week}
        empty="No trials started in the last 12 weeks."
        columns={[
          {
            label: "Week of",
            cell: (r) => (
              <span>
                {r.week} {r.provisional && <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">in progress</span>}
              </span>
            ),
          },
          { label: "Trials", cell: (r) => r.trials, align: "right" },
          { label: "Converted", cell: (r) => r.converted, align: "right" },
          { label: "Conversion", cell: (r) => pct(r.conversionRate), align: "right" },
          { label: "AI cost in trial", cell: (r) => usd(r.trialCostUsd), align: "right" },
          { label: "Per trial", cell: (r) => usd(r.costPerTrial), align: "right" },
          { label: "Per converted trial", cell: (r) => usd(r.costPerConvertedTrial), align: "right" },
        ]}
      />
      <p className="mt-3 text-xs text-foreground/50">
        Cost counts only days inside the trial. &quot;In progress&quot; cohorts still have trials running, so their conversion is not final.
      </p>
    </Card>
    </>
  );
}
