import type { schema } from "@fiscallm/shared";
import { ALERT_LABELS } from "@fiscallm/shared/alerts";
import { addAlertRule, deleteAlertRule, sendTestAlert, setAlertRuleEnabled } from "@/app/dashboard/actions";
import { CopyField } from "./copy-button";
import { Button, Card, Input } from "./ui";

type Rule = typeof schema.alertRules.$inferSelect;
type Event = typeof schema.alertEvents.$inferSelect;

const KINDS = Object.entries(ALERT_LABELS) as [Rule["kind"], string][];

function thresholdText(r: Rule) {
  if (r.threshold === null) return "";
  const n = Number(r.threshold);
  if (r.kind === "user_burst") return `${n.toLocaleString("en-US")} tokens`;
  return r.kind === "app_cost_share" ? `${(n * 100).toFixed(0)}%` : `$${n}`;
}

export function AlertsCard({ appId, rules, events, alertSecret }: { appId: string; rules: Rule[]; events: Event[]; alertSecret: string | null }) {
  return (
    <Card title={<span id="alerts">Budgets and alerts</span>}>
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-foreground/70">
          Get an email, a Slack message, or a webhook your backend can act on. Per-user budgets and the 5-minute token limit (to catch a runaway
          loop) are checked as usage arrives; the others once a day. Each alert fires at most once per user per day. To refuse a user over budget,
          tick &quot;Block&quot; below and call <code>meter.check(userId)</code> before the AI call; see the{" "}
          <a href="/docs#caps" className="underline">
            docs
          </a>
          .
        </p>

        {rules.length > 0 && (
          <ul className="divide-y divide-foreground/10 rounded border border-foreground/10">
            {rules.map((r) => (
              <li key={r.id} className={`flex flex-wrap items-center gap-3 px-3 py-2 ${r.enabled ? "" : "opacity-50"}`}>
                <span className="flex-1">
                  {ALERT_LABELS[r.kind]} <strong>{thresholdText(r)}</strong>
                  <span className="block text-xs text-foreground/60">
                    {[r.email && "email", r.webhookUrl && (r.webhookUrl.startsWith("https://hooks.slack.com/") ? "Slack" : `webhook ${r.webhookUrl}`), r.enforce && "blocks over-budget users (meter.check)"]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <form action={sendTestAlert.bind(null, appId, r.id)}>
                  <button className="text-xs underline">Send test</button>
                </form>
                <form action={setAlertRuleEnabled.bind(null, appId, r.id, !r.enabled)}>
                  <button className="text-xs underline">{r.enabled ? "Pause" : "Resume"}</button>
                </form>
                <form action={deleteAlertRule.bind(null, appId, r.id)}>
                  <button className="text-xs text-red-600 underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addAlertRule.bind(null, appId)} className="flex flex-col gap-2 rounded border border-dashed border-foreground/15 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
            <select name="kind" className="rounded border border-foreground/20 bg-transparent px-2 py-1.5 text-sm" defaultValue="user_daily_cost">
              {KINDS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <Input name="threshold" inputMode="decimal" placeholder="$, % or tokens (e.g. 5)" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" name="email" defaultChecked /> Email me
            </label>
            <Input name="webhookUrl" placeholder="Slack or webhook URL (optional, https://…)" className="min-w-0 flex-1" />
            <Button type="submit">Add alert</Button>
          </div>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" name="enforce" /> Block: also refuse this user in <code>meter.check</code> once they reach the amount (daily and 30-day budgets only)
          </label>
          <p className="text-xs text-foreground/60">
            Amounts are USD; the revenue-share alert takes a percentage; the 5-minute limit takes a token count. &quot;A model without a price&quot; needs no
            amount. For Slack, paste an incoming-webhook URL (https://hooks.slack.com/services/…).
          </p>
        </form>

        {alertSecret && (
          <div>
            <div className="mb-1 text-xs text-foreground/60">
              Webhook signing secret. Each request has <code>X-FiscaLLM-Signature: t=…,v1=…</code>, an HMAC-SHA256 of <code>t.body</code>; see the docs.
            </div>
            <CopyField value={alertSecret} secret />
          </div>
        )}

        {events.length > 0 && (
          <div>
            <div className="mb-1 text-xs text-foreground/60">Recent alerts</div>
            <ul className="space-y-1 text-xs">
              {events.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span>{(e.payload as { message?: string }).message}</span>
                  <span className="shrink-0 text-foreground/50">{e.sentAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
