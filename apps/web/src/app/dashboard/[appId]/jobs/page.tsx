import { jobLoss, type JobLossUser } from "@fiscallm/shared/metrics";
import { Suspense } from "react";
import { RangePicker } from "@/components/range-picker";
import { Stat } from "@/components/stat";
import { Money, Table } from "@/components/table";
import { Card, Code, PageHeader, usd } from "@/components/ui";
import { requireApp } from "@/lib/auth";
import { metricsDb } from "@/lib/db";
import { rangeFrom } from "@/lib/range";

export default function JobsPage(props: PageProps<"/dashboard/[appId]/jobs">) {
  return (
    <Suspense fallback={<p className="text-foreground/60">Loading…</p>}>
      <Jobs {...props} />
    </Suspense>
  );
}

async function Jobs({ params, searchParams }: PageProps<"/dashboard/[appId]/jobs">) {
  const app = await requireApp((await params).appId);
  const { days, range } = rangeFrom(await searchParams);
  const r = await jobLoss(metricsDb(), app.id, range);
  const t = r.totals;
  const base = `/dashboard/${app.id}/jobs`;
  const any = t.captured.jobs + t.refunded.jobs + t.unresolved.jobs + t.inProgress.jobs > 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Jobs" subtitle="AI cost of work the user was not charged for." action={<RangePicker base={base} days={days} />} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Captured" value={usd(t.captured.costUsd)} hint={`${t.captured.jobs.toLocaleString()} jobs, user charged`} />
        <Stat label="Refunded" value={usd(t.refunded.costUsd)} hint={`${t.refunded.jobs.toLocaleString()} jobs, payment given back`} tone={t.refunded.costUsd > 0 ? "bad" : undefined} />
        <Stat label="Unresolved" value={usd(t.unresolved.costUsd)} hint={`${t.unresolved.jobs.toLocaleString()} jobs, no outcome after 1 hour`} tone={t.unresolved.costUsd > 0 ? "bad" : undefined} />
        <Stat label="In progress" value={usd(t.inProgress.costUsd)} hint={`${t.inProgress.jobs.toLocaleString()} jobs`} />
      </div>
      <Card title="Users with cost they were not charged for">
        <Table<JobLossUser>
          rows={r.users}
          rowKey={(x) => x.userId}
          empty={any ? "No refunded or unresolved jobs in this period." : "No jobs yet. Send a jobId with your AI events, then report each job's outcome."}
          columns={[
            { label: "User", cell: (x) => <span className="font-mono text-xs">{x.userId}</span> },
            { label: "Refunded jobs", cell: (x) => x.refundedJobs.toLocaleString(), align: "right" },
            { label: "Refunded cost", cell: (x) => <Money v={-x.refundedCostUsd} />, align: "right" },
            { label: "Unresolved jobs", cell: (x) => x.unresolvedJobs.toLocaleString(), align: "right" },
            { label: "Unresolved cost", cell: (x) => <Money v={-x.unresolvedCostUsd} />, align: "right" },
          ]}
        />
        <p className="mt-3 text-xs text-foreground/50">
          This cost is already in each user&apos;s margin; this page shows how much of it bought nothing they paid for.
          Unresolved jobs have no captured or refunded status an hour after their last event, for example a provider
          timeout you have not reconciled. Raw events are kept 90 days, so this covers {r.range.from} onward.
          {r.unpriced > 0 && ` ${r.unpriced.toLocaleString()} job events have no price and are not in these totals.`}
        </p>
      </Card>
      {!any && (
        <Card title="Set up">
          <p className="text-sm text-foreground/70">
            Tag each AI call with your job id, e.g. <Code>{`meter.track({ ..., jobId })`}</Code>, then report the
            payment: <Code>{`meter.trackJob({ jobId, userId, status: "captured" })`}</Code>. Statuses: <Code>pending</Code>,{" "}
            <Code>captured</Code>, <Code>refunded</Code>.
          </p>
        </Card>
      )}
    </div>
  );
}
