"use client";

import { useMemo, useState } from "react";

export interface CalcModel {
  slug: string;
  name: string;
  providerName: string;
  input: number;
  cached: number;
  output: number;
}

const fmt = (n: number) =>
  n === 0 ? "$0" : Math.abs(n) < 0.01 ? `$${n.toPrecision(2)}` : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Field({ label, value, onChange, step = 1, suffix }: { label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          step={step}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2"
        />
        {suffix && <span className="text-xs text-muted">{suffix}</span>}
      </span>
    </label>
  );
}

/** AI cost per user and margin for a subscription plan, for any listed model. */
export function CostCalculator({ models, initial }: { models: CalcModel[]; initial?: string }) {
  const [slug, setSlug] = useState(initial ?? models[0]!.slug);
  const [input, setInput] = useState(1500);
  const [output, setOutput] = useState(400);
  const [cachedPct, setCachedPct] = useState(0);
  const [messages, setMessages] = useState(300);
  const [price, setPrice] = useState(9.99);
  const [feePct, setFeePct] = useState(15);

  const m = models.find((x) => x.slug === slug) ?? models[0]!;
  const r = useMemo(() => {
    const cached = input * (cachedPct / 100);
    const perMessage = ((input - cached) * m.input + cached * m.cached + output * m.output) / 1e6;
    const perUser = perMessage * messages;
    const net = price * (1 - feePct / 100);
    return { perMessage, perUser, net, margin: net - perUser, breakEven: perMessage > 0 ? Math.floor(net / perMessage) : Infinity };
  }, [m, input, output, cachedPct, messages, price, feePct]);

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm sm:col-span-3">
          <span className="text-muted">Model</span>
          <select value={slug} onChange={(e) => setSlug(e.target.value)} className="rounded-lg border border-black/10 bg-white px-3 py-2">
            {models.map((x) => (
              <option key={x.slug} value={x.slug}>
                {x.providerName} · {x.name}
              </option>
            ))}
          </select>
        </label>
        <Field label="Input tokens per message" value={input} onChange={setInput} step={100} />
        <Field label="Output tokens per message" value={output} onChange={setOutput} step={50} />
        <Field label="Prompt read from cache" value={cachedPct} onChange={(n) => setCachedPct(Math.min(100, n))} suffix="%" />
        <Field label="Messages per user per month" value={messages} onChange={setMessages} step={10} />
        <Field label="Plan price per month" value={price} onChange={setPrice} step={1} suffix="USD" />
        <Field label="Store or payment fee" value={feePct} onChange={(n) => setFeePct(Math.min(100, n))} suffix="%" />
      </div>
      <dl className="mt-5 grid gap-3 border-t border-black/5 pt-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">Cost per message</dt>
          <dd className="text-lg font-semibold">{fmt(r.perMessage)}</dd>
        </div>
        <div>
          <dt className="text-muted">AI cost per user / month</dt>
          <dd className="text-lg font-semibold">{fmt(r.perUser)}</dd>
        </div>
        <div>
          <dt className="text-muted">Margin per user / month</dt>
          <dd className={`text-lg font-semibold ${r.margin < 0 ? "text-red-600" : "text-green-700"}`}>{fmt(r.margin)}</dd>
        </div>
        <div>
          <dt className="text-muted">Break-even messages / month</dt>
          <dd className="text-lg font-semibold">{Number.isFinite(r.breakEven) ? r.breakEven.toLocaleString("en-US") : "∞"}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">
        List prices, standard tier, prompts under the long-context threshold. Averages hide your heaviest users: FiscaLLM shows this per real user.
      </p>
    </div>
  );
}
