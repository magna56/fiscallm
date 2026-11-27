"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CalcModel } from "./cost-calculator";

// Plan an AI app's pricing before launch: margin per plan, what a heavy
// user costs, a monthly AI limit per plan and a free tier you can afford.
// Everything runs in the browser; the state is kept in the URL hash so a
// plan can be shared as a link.

interface Paid {
  name: string;
  price: number;
  messages: number;
  share: number;
}

interface State {
  model: string;
  input: number;
  output: number;
  cachedPct: number;
  feePct: number;
  targetPct: number;
  heavyX: number;
  freeOn: boolean;
  freeMessages: number;
  freeRatio: number;
  paid: Paid[];
}

const DEFAULTS: Omit<State, "model"> = {
  input: 1500,
  output: 400,
  cachedPct: 50,
  feePct: 15,
  targetPct: 70,
  heavyX: 5,
  freeOn: true,
  freeMessages: 60,
  freeRatio: 10,
  paid: [
    { name: "Pro", price: 9.99, messages: 300, share: 80 },
    { name: "Max", price: 29.99, messages: 1200, share: 20 },
  ],
};

const usd = (n: number) => {
  const a = Math.abs(n);
  const s = a === 0 ? "0" : a < 0.01 ? a.toPrecision(2) : a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}$${s}`;
};
const pct = (n: number) => (Number.isFinite(n) ? `${Math.round(n * 100)}%` : "-");
const int = (n: number) => Math.max(0, Math.floor(n)).toLocaleString("en-US");
/** Round a price up to the next .99. */
const price99 = (n: number) => (n <= 0 ? 0 : Math.max(0.99, Math.ceil(n + 0.01) - 0.01));

function Num({ label, value, onChange, step = 1, max, suffix }: { label: string; value: number; onChange: (n: number) => void; step?: number; max?: number; suffix?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Math.max(0, Number(e.target.value) || 0);
            onChange(max === undefined ? n : Math.min(max, n));
          }}
          className="w-full min-w-0 rounded-lg border border-black/10 bg-white px-3 py-2"
        />
        {suffix && <span className="shrink-0 text-xs text-muted">{suffix}</span>}
      </span>
    </label>
  );
}

function readHash(): Partial<State> | null {
  try {
    const h = window.location.hash.slice(1);
    if (!h.startsWith("p=")) return null;
    return JSON.parse(decodeURIComponent(atob(h.slice(2))));
  } catch {
    return null;
  }
}

export function PricingPlanner({ models, initial }: { models: CalcModel[]; initial: string }) {
  const [s, setS] = useState<State>({ model: initial, ...DEFAULTS });
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));
  const setPaid = (i: number, patch: Partial<Paid>) => setS((p) => ({ ...p, paid: p.paid.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  useEffect(() => {
    const h = readHash();
    if (h) setS((p) => ({ ...p, ...h, paid: Array.isArray(h.paid) && h.paid.length ? h.paid : p.paid }));
  }, []);

  const m = models.find((x) => x.slug === s.model) ?? models[0]!;

  const r = useMemo(() => {
    const cached = s.input * (s.cachedPct / 100);
    const perMsg = ((s.input - cached) * m.input + cached * m.cached + s.output * m.output) / 1e6;
    const keep = 1 - s.feePct / 100;
    const target = s.targetPct / 100;
    const shareSum = s.paid.reduce((a, p) => a + p.share, 0) || 1;
    const plans = s.paid.map((p) => {
      const net = p.price * keep;
      const cost = p.messages * perMsg;
      const heavyCost = cost * s.heavyX;
      return {
        ...p,
        net,
        cost,
        margin: net - cost,
        marginPct: net > 0 ? (net - cost) / net : -Infinity,
        heavyMargin: net - heavyCost,
        limit: perMsg > 0 ? (net * (1 - target)) / perMsg : Infinity,
        suggested: keep > 0 && target < 1 ? price99(cost / (1 - target) / keep) : 0,
        w: p.share / shareSum,
      };
    });
    const avgNet = plans.reduce((a, p) => a + p.w * p.net, 0);
    const avgCost = plans.reduce((a, p) => a + p.w * p.cost, 0);
    const freeCost = s.freeOn ? s.freeMessages * perMsg : 0;
    const freeBurden = s.freeOn ? freeCost * s.freeRatio : 0;
    const blended = avgNet > 0 ? (avgNet - avgCost - freeBurden) / avgNet : -Infinity;
    // The largest free allowance that still leaves the target margin overall.
    const room = avgNet * (1 - target) - avgCost;
    const freeLimit = s.freeOn && perMsg > 0 && s.freeRatio > 0 ? room / (s.freeRatio * perMsg) : Infinity;
    return { perMsg, plans, avgNet, avgCost, freeCost, freeBurden, blended, freeLimit, room };
  }, [m, s]);

  const ok = r.blended >= s.targetPct / 100;
  const losers = r.plans.filter((p) => p.heavyMargin < 0);

  async function share() {
    try {
      const hash = "p=" + btoa(encodeURIComponent(JSON.stringify(s)));
      history.replaceState(null, "", `#${hash}`);
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the URL already holds the plan */
    }
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 text-left shadow-sm sm:p-6">
      {/* 1. What one AI action costs */}
      <h3 className="text-sm font-semibold">1. One AI action in your app</h3>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-4">
          <span className="text-muted">Model</span>
          <select value={m.slug} onChange={(e) => set("model", e.target.value)} className="rounded-lg border border-black/10 bg-white px-3 py-2">
            {models.map((x) => (
              <option key={x.slug} value={x.slug}>
                {x.providerName} · {x.name}
              </option>
            ))}
          </select>
        </label>
        <Num label="Input tokens" value={s.input} onChange={(n) => set("input", n)} step={100} />
        <Num label="Output tokens" value={s.output} onChange={(n) => set("output", n)} step={50} />
        <Num label="Prompt from cache" value={s.cachedPct} onChange={(n) => set("cachedPct", n)} max={100} suffix="%" />
        <div className="flex flex-col justify-end text-sm">
          <span className="text-muted">Cost per action</span>
          <span className="py-2 text-lg font-semibold">{usd(r.perMsg)}</span>
        </div>
      </div>

      {/* 2. Plans */}
      <h3 className="mt-7 text-sm font-semibold">2. Your plans</h3>
      <div className="mt-3 flex flex-col gap-3">
        {s.paid.map((p, i) => (
          <div key={i} className="grid grid-cols-2 gap-3 rounded-xl border border-black/5 bg-black/[0.015] p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <label className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="text-muted">Plan</span>
              <input value={p.name} onChange={(e) => setPaid(i, { name: e.target.value })} className="w-full min-w-0 rounded-lg border border-black/10 bg-white px-3 py-2" />
            </label>
            <Num label="Price / month" value={p.price} onChange={(n) => setPaid(i, { price: n })} step={1} suffix="USD" />
            <Num label="Actions / user / month" value={p.messages} onChange={(n) => setPaid(i, { messages: n })} step={10} />
            <Num label="Share of payers" value={p.share} onChange={(n) => setPaid(i, { share: n })} max={100} suffix="%" />
            <button
              type="button"
              onClick={() => setS((x) => ({ ...x, paid: x.paid.filter((_, j) => j !== i) }))}
              disabled={s.paid.length === 1}
              className="col-span-2 self-end rounded-lg px-2 py-2 text-xs text-muted hover:text-foreground disabled:opacity-30 sm:col-span-1"
              aria-label={`Remove ${p.name}`}
            >
              Remove
            </button>
          </div>
        ))}
        {s.paid.length < 4 && (
          <button
            type="button"
            onClick={() => setS((x) => ({ ...x, paid: [...x.paid, { name: "Team", price: 49.99, messages: 3000, share: 0 }] }))}
            className="self-start rounded-full border border-black/10 px-3 py-1.5 text-xs hover:bg-black/[0.03]"
          >
            + Add a plan
          </button>
        )}
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-dashed border-black/10 p-3 sm:grid-cols-4">
          <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-1">
            <input type="checkbox" checked={s.freeOn} onChange={(e) => set("freeOn", e.target.checked)} />
            Free plan
          </label>
          <Num label="Free actions / user / month" value={s.freeMessages} onChange={(n) => set("freeMessages", n)} step={5} />
          <Num label="Free users per payer" value={s.freeRatio} onChange={(n) => set("freeRatio", n)} />
          <div className="flex flex-col justify-end text-sm">
            <span className="text-muted">Cost per free user</span>
            <span className="py-2 font-semibold">{s.freeOn ? usd(r.freeCost) : "-"}</span>
          </div>
        </div>
      </div>

      {/* 3. Assumptions */}
      <h3 className="mt-7 text-sm font-semibold">3. Assumptions</h3>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Num label="Store or payment fee" value={s.feePct} onChange={(n) => set("feePct", n)} max={100} suffix="%" />
        <Num label="Target AI margin" value={s.targetPct} onChange={(n) => set("targetPct", n)} max={99} suffix="%" />
        <Num label="Heaviest users use" value={s.heavyX} onChange={(n) => set("heavyX", n)} step={1} suffix="× typical" />
      </div>

      {/* Results */}
      <div className="mt-8 border-t border-black/5 pt-6">
        <div className={`rounded-xl p-4 text-sm ${ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}>
          <p className="font-semibold">
            {ok ? "This pricing holds your target margin." : "This pricing misses your target margin."}{" "}
            <span className="font-normal">
              Blended AI margin {pct(r.blended)} after free users, against a {s.targetPct}% target.
            </span>
          </p>
          {losers.length > 0 && (
            <p className="mt-1">
              A heavy user loses you money on {losers.map((p) => p.name).join(" and ")}: set a monthly limit (below) so no single user can.
            </p>
          )}
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2 pr-3 font-medium">Plan</th>
                <th className="py-2 pr-3 font-medium">You keep</th>
                <th className="py-2 pr-3 font-medium">AI cost, typical</th>
                <th className="py-2 pr-3 font-medium">Margin</th>
                <th className="py-2 pr-3 font-medium">Heavy user</th>
                <th className="py-2 pr-3 font-medium">Lowest price for {s.targetPct}%</th>
              </tr>
            </thead>
            <tbody>
              {r.plans.map((p, i) => (
                <tr key={i} className="border-t border-black/5">
                  <td className="py-2 pr-3 font-medium">{p.name || `Plan ${i + 1}`}</td>
                  <td className="py-2 pr-3">{usd(p.net)}</td>
                  <td className="py-2 pr-3">{usd(p.cost)}</td>
                  <td className={`py-2 pr-3 ${p.marginPct < s.targetPct / 100 ? "text-red-600" : "text-green-700"}`}>{pct(p.marginPct)}</td>
                  <td className={`py-2 pr-3 ${p.heavyMargin < 0 ? "text-red-600" : ""}`}>{usd(p.heavyMargin)}</td>
                  <td className="py-2 pr-3">{p.suggested ? usd(p.suggested) : "-"}</td>
                </tr>
              ))}
              {s.freeOn && (
                <tr className="border-t border-black/5 text-muted">
                  <td className="py-2 pr-3 font-medium">Free</td>
                  <td className="py-2 pr-3">$0.00</td>
                  <td className="py-2 pr-3">{usd(r.freeCost)}</td>
                  <td className="py-2 pr-3" colSpan={3}>
                    {usd(r.freeBurden)} carried by each payer ({s.freeRatio} free users)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          You keep: price after the store or payment fee. Heavy user: what you keep minus AI cost for someone using {s.heavyX}× the typical amount. Lowest price: the floor for typical use; charge more for what the app is worth.
        </p>

        <div className="mt-6 rounded-xl border border-black/5 bg-[#fafafc] p-4">
          <p className="text-sm font-semibold">Limits that keep a {s.targetPct}% margin, even for your heaviest user</p>
          <ul className="mt-2 grid gap-1 font-mono text-[13px]">
            {s.freeOn && (
              <li>
                free: {r.freeLimit <= 0 ? <span className="text-red-600">no room for a free tier; raise prices or margin first</span> : `${int(r.freeLimit)} actions / month (about ${int(r.freeLimit / 30)} a day)`}
              </li>
            )}
            {r.plans.map((p, i) => (
              <li key={i}>
                {(p.name || `plan ${i + 1}`).toLowerCase()}: {Number.isFinite(p.limit) ? `${int(p.limit)} actions / month` : "no limit needed"}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            The free limit is the most you can give away with {s.freeRatio} free users per payer and still reach the target overall. A paid limit is
            the most one user can use before their plan earns less than the target.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={share} className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/[0.03]">
            {copied ? "Link copied" : "Copy a link to this plan"}
          </button>
          <Link href="/guides/ai-usage-limits-by-plan" className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white hover:opacity-85">
            Enforce these limits in your app →
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted">
          List prices, standard tier. Runs in your browser; nothing you type is sent anywhere. Real users vary: once you launch, FiscaLLM shows the
          actual AI cost and margin of every user against what they paid.
        </p>
      </div>
    </div>
  );
}
