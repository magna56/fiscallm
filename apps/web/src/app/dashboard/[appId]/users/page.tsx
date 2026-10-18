import { users, type UserRow } from "@fiscallm/shared/metrics";
import Link from "next/link";
import { Suspense } from "react";
import { DownloadCsv } from "@/components/download-csv";
import { RangePicker } from "@/components/range-picker";
import { Money, Table } from "@/components/table";
import { Card, PageHeader } from "@/components/ui";
import { requireApp } from "@/lib/auth";
import { metricsDb } from "@/lib/db";
import { rangeFrom } from "@/lib/range";

const PAGE = 50;

export default function UsersPage(props: PageProps<"/dashboard/[appId]/users">) {
  return (
    <Suspense fallback={<p className="text-foreground/60">Loading…</p>}>
      <Users {...props} />
    </Suspense>
  );
}

async function Users({ params, searchParams }: PageProps<"/dashboard/[appId]/users">) {
  const app = await requireApp((await params).appId);
  const sp = await searchParams;
  const { days, range } = rangeFrom(sp);
  const losing = sp.losing === "1";
  const page = Math.max(0, Number(sp.page) || 0);
  const rows = await users(metricsDb(), app.id, range, { losingOnly: losing, limit: PAGE + 1, offset: page * PAGE });
  const base = `/dashboard/${app.id}/users`;
  const q = (o: Record<string, string | number>) =>
    `${base}?${new URLSearchParams({ days: String(days), ...(losing ? { losing: "1" } : {}), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) })}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Users" subtitle="Worst margin first." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-black/[0.08] bg-white p-0.5 text-sm shadow-sm">
          <Link href={`${base}?days=${days}`} className={`rounded-full px-3 py-1 ${!losing ? "bg-foreground text-white" : "text-black/60"}`}>
            All users
          </Link>
          <Link href={`${base}?days=${days}&losing=1`} className={`rounded-full px-3 py-1 ${losing ? "bg-foreground text-white" : "text-black/60"}`}>
            Paying and losing money
          </Link>
        </div>
        <RangePicker base={base} days={days} query={losing ? "losing=1" : undefined} />
      </div>
      <Card title="Users, worst margin first" action={<DownloadCsv href={`/dashboard/${app.id}/export/users?days=${days}${losing ? "&losing=1" : ""}`} />}>
        <Table<UserRow>
          rows={rows.slice(0, PAGE)}
          rowKey={(r) => r.userId}
          empty={losing ? "No paying users are losing money in this period." : "No users with activity in this period."}
          columns={[
            { label: "User", cell: (r) => <span className="font-mono text-xs">{r.userId}</span> },
            { label: "Status", cell: (r) => r.state ?? <span className="text-foreground/50">free or unmatched</span> },
            { label: "Plan", cell: (r) => <span className="font-mono text-xs">{r.productId ?? ""}</span> },
            { label: "Requests", cell: (r) => r.requests.toLocaleString(), align: "right" },
            { label: "AI cost", cell: (r) => <Money v={r.costUsd} />, align: "right" },
            { label: "Net revenue", cell: (r) => <Money v={r.revenueUsd} />, align: "right" },
            { label: "Margin", cell: (r) => <Money v={r.marginUsd} />, align: "right" },
          ]}
        />
        <div className="mt-3 flex justify-between text-sm">
          {page > 0 ? <Link href={q({ page: page - 1 })} className="underline">Previous</Link> : <span />}
          {rows.length > PAGE ? <Link href={q({ page: page + 1 })} className="underline">Next</Link> : <span />}
        </div>
      </Card>
    </div>
  );
}
