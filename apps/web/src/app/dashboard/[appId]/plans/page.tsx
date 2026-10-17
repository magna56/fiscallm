import { plans, type PlanRow } from "@fiscallm/shared/metrics";
import { Suspense } from "react";
import { RangePicker } from "@/components/range-picker";
import { Money, Table } from "@/components/table";
import { Card, pct } from "@/components/ui";
import { requireApp } from "@/lib/auth";
import { metricsDb } from "@/lib/db";
import { rangeFrom } from "@/lib/range";

export default function PlansPage(props: PageProps<"/dashboard/[appId]/plans">) {
  return (
    <Suspense fallback={<p className="text-foreground/60">Loading…</p>}>
      <Plans {...props} />
    </Suspense>
  );
}

async function Plans({ params, searchParams }: PageProps<"/dashboard/[appId]/plans">) {
  const app = await requireApp((await params).appId);
  const { days, range } = rangeFrom(await searchParams);
  const rows = await plans(metricsDb(), app.id, range);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <RangePicker base={`/dashboard/${app.id}/plans`} days={days} />
      </div>
      <Card title="Plans, worst margin first">
        <Table<PlanRow>
          rows={rows}
          rowKey={(r) => r.productId}
          empty="No subscribers with activity in this period."
          columns={[
            { label: "Product", cell: (r) => <span className="font-mono text-xs">{r.productId}</span> },
            { label: "Users", cell: (r) => r.users, align: "right" },
            { label: "Net revenue", cell: (r) => <Money v={r.revenueUsd} />, align: "right" },
            { label: "AI cost", cell: (r) => <Money v={r.costUsd} />, align: "right" },
            { label: "Margin", cell: (r) => <Money v={r.marginUsd} />, align: "right" },
            { label: "Cost / revenue", cell: (r) => pct(r.costShare), align: "right" },
          ]}
        />
        <p className="mt-3 text-xs text-foreground/50">Each user&apos;s AI cost counts toward the plan they are on now.</p>
      </Card>
    </div>
  );
}
