import type { schema } from "@fiscallm/shared";
import { cancelImport, startImport } from "@/app/dashboard/actions";
import { AutoRefresh } from "./auto-refresh";
import { Button, Card, Input, Notice } from "./ui";

type Job = typeof schema.rcImports.$inferSelect;

/** Settings card for importing subscribers who paid before the webhook was connected. */
export function ImportCard({ appId, job }: { appId: string; job: Job | undefined }) {
  const running = job?.status === "running";
  return (
    <Card title={<span id="import">Import past subscribers</span>}>
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-foreground/70">
          RevenueCat&apos;s webhook only sends new events. Import your existing subscribers&apos; purchases, renewals and trials from
          RevenueCat&apos;s API, so revenue is complete from day one. Purchases the webhook already delivered are not imported again.
        </p>

        {running && (
          <>
            <AutoRefresh seconds={4} />
            <Notice>
              Importing… {job.customersDone.toLocaleString()} customers, {job.eventsImported.toLocaleString()} purchases so far. You can leave
              this page; it keeps running.
            </Notice>
            <form action={cancelImport.bind(null, appId)}>
              <Button variant="secondary" type="submit">
                Stop import
              </Button>
            </form>
          </>
        )}
        {job?.status === "done" && (
          <Notice tone="ok">
            Imported {job.customersDone.toLocaleString()} customers and {job.eventsImported.toLocaleString()} purchases
            {job.finishedAt ? ` on ${job.finishedAt.toISOString().slice(0, 10)}` : ""}. The key was deleted.
          </Notice>
        )}
        {job?.status === "failed" && <Notice tone="error">{job.error}</Notice>}
        {job?.status === "cancelled" && <Notice>Import stopped after {job.customersDone.toLocaleString()} customers.</Notice>}

        {!running && (
          <form action={startImport.bind(null, appId)} className="flex flex-col gap-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input name="projectId" required placeholder="RevenueCat project ID" autoComplete="off" />
              <Input name="secretKey" required type="password" placeholder="v2 secret key (sk_…)" autoComplete="off" />
            </div>
            <p className="text-xs text-foreground/60">
              In RevenueCat: Project settings → API keys → New secret key, version V2, read-only access to Customer information. The key is
              kept encrypted only while the import runs.
            </p>
            <div>
              <Button type="submit">{job ? "Import again" : "Start import"}</Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
