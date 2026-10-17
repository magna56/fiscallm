"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LogoMark } from "./logo-mark";

// An animated walk-through of one request: app → backend → AI provider,
// usage → FiscaLLM, revenue from RevenueCat, then a budget alert back to
// the backend. Positions are percentages of a fixed-ratio canvas.

type Pt = { x: number; y: number };
const NODES = {
  phone: { x: 9, y: 30 },
  backend: { x: 40, y: 30 },
  ai: { x: 71, y: 12 },
  rc: { x: 9, y: 82 },
  fiscallm: { x: 71, y: 64 },
} satisfies Record<string, Pt>;

interface Step {
  caption: string;
  packet?: { from: Pt; to: Pt; label: string; color: string };
}

const STEPS: Step[] = [
  { caption: "A user asks your app for something." },
  { caption: "The app sends the request to your backend.", packet: { from: NODES.phone, to: NODES.backend, label: "“Rewrite my essay”", color: "#6d5dfc" } },
  { caption: "Your backend calls the AI provider, as it always has.", packet: { from: NODES.backend, to: NODES.ai, label: "prompt", color: "#6d5dfc" } },
  { caption: "The answer comes back with its token count.", packet: { from: NODES.ai, to: NODES.backend, label: "1,842 tokens", color: "#a855f7" } },
  { caption: "One line of SDK reports the usage. Never the prompt, never the answer.", packet: { from: NODES.backend, to: NODES.fiscallm, label: "user_k3x9 · 1,842 tokens", color: "#a855f7" } },
  { caption: "FiscaLLM prices it and adds it to that user's cost." },
  { caption: "RevenueCat reports what the same user paid.", packet: { from: NODES.rc, to: NODES.fiscallm, label: "renewal +$7.49", color: "#16a34a" } },
  { caption: "Cost passes the user's budget, so you get an alert…" },
  { caption: "…and a webhook your backend can act on.", packet: { from: NODES.fiscallm, to: NODES.backend, label: "slow down user_k3x9", color: "#dc2626" } },
];
const STEP_MS = 1700;
const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function FlowDemo() {
  const [stepState, setStep] = useState(0);
  let step = stepState;
  const [loop, setLoop] = useState(0);
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const reduced = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED).matches, () => false);

  // Only animate while visible.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setActive(Boolean(e?.isIntersecting)), { threshold: 0.35 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!active || reduced) return;
    const id = setInterval(() => {
      setStep((s) => {
        if (s + 1 < STEPS.length) return s + 1;
        setLoop((l) => l + 1);
        return 0;
      });
    }, STEP_MS);
    return () => clearInterval(id);
  }, [active, reduced]);

  if (reduced) step = STEPS.length - 1;
  // Cost grows each loop; the step at which each change shows.
  // Starts just under revenue, so the margin turns red as the alert fires.
  const baseCost = 6.9 + loop * 0.84;
  const cost = step >= 5 ? baseCost + 0.84 : baseCost;
  // Paid once a month; cost keeps growing on later loops.
  const revenue = loop > 0 || step >= 6 ? 7.49 : 0;
  const margin = revenue - cost;
  const alert = step >= 7;
  const current = STEPS[step]!;

  return (
    <div ref={ref} className="flex flex-col gap-4">
      <MobileFlow step={step} cost={cost} margin={revenue === 0 ? null : margin} />
      <div className="relative hidden w-full overflow-hidden rounded-3xl border border-black/5 bg-gradient-to-br from-[#fafaff] via-white to-[#fdf7fb] sm:block" style={{ aspectRatio: "16 / 8.2", containerType: "inline-size" }}>
        <div className="dot-grid opacity-60" aria-hidden />

        {/* connection lines */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {[
            [NODES.phone, NODES.backend],
            [NODES.backend, NODES.ai],
            [NODES.backend, NODES.fiscallm],
            [NODES.rc, NODES.fiscallm],
          ].map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(11,11,20,0.12)" strokeWidth="0.25" strokeDasharray="0.8 0.8" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        {/* phone */}
        <Node at={NODES.phone} glow={step <= 1}>
          <div className="w-[13.5cqw] min-w-[96px] rounded-[18px] border-2 border-black/80 bg-white p-2 shadow-lg">
            <div className="mx-auto mb-2 h-1 w-6 rounded-full bg-black/20" />
            <div className="space-y-1.5 text-[clamp(8px,1.05cqw,12px)]">
              <div className="ml-auto w-fit rounded-xl rounded-br-sm bg-[#6d5dfc] px-2 py-1 text-white">
                <Typed text="Rewrite my essay" run={step >= 0} key={`${loop}-q`} />
              </div>
              <div className={`w-fit rounded-xl rounded-bl-sm bg-black/[0.06] px-2 py-1 transition-opacity duration-500 ${step >= 4 ? "opacity-100" : "opacity-0"}`}>
                Here&apos;s a sharper version…
              </div>
            </div>
          </div>
          <Label>Your app</Label>
        </Node>

        {/* backend */}
        <Node at={NODES.backend} glow={[1, 2, 3, 4, 8].includes(step)}>
          <Box title="Your backend">
            <code className="block whitespace-nowrap text-[clamp(7px,0.95cqw,11px)] text-black/60">meter.trackOpenAI(res, {"{ userId }"})</code>
            <div className={`mt-1.5 rounded-md px-2 py-1 text-[clamp(7px,0.95cqw,11px)] font-medium transition-all duration-500 ${step === 8 ? "bg-red-50 text-red-600" : "bg-transparent text-transparent"}`}>
              ⚡ user_k3x9 slowed down
            </div>
          </Box>
        </Node>

        {/* AI providers */}
        <Node at={NODES.ai} glow={step === 2 || step === 3}>
          <Box title="AI provider">
            <div className="flex gap-1">
              {["OpenAI", "Anthropic", "Gemini"].map((p) => (
                <span key={p} className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[clamp(7px,0.9cqw,10px)]">
                  {p}
                </span>
              ))}
            </div>
          </Box>
        </Node>

        {/* RevenueCat */}
        <Node at={NODES.rc} glow={step === 6}>
          <Box title="RevenueCat">
            <div className="text-[clamp(7px,0.95cqw,11px)] text-black/60">user_k3x9 · Pro monthly</div>
          </Box>
        </Node>

        {/* FiscaLLM */}
        <Node at={NODES.fiscallm} glow={step >= 5}>
          <div className="w-[25cqw] min-w-[180px] rounded-2xl bg-gradient-to-br from-[#6d5dfc] via-[#a855f7] to-[#ec4899] p-[1.5px] shadow-xl shadow-indigo-500/20">
            <div className="rounded-[15px] bg-white p-3">
              <div className="flex items-center gap-1.5 text-[clamp(8px,1.05cqw,12px)] font-semibold">
                <LogoMark className="h-4 w-4" />
                FiscaLLM
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-[clamp(7px,0.9cqw,10px)] text-black/50">
                <span>user</span>
                <span className="text-right">AI cost</span>
                <span className="text-right">margin</span>
              </div>
              <div className={`mt-0.5 grid grid-cols-3 gap-1 rounded-md px-1 py-0.5 font-mono text-[clamp(7px,0.95cqw,11px)] transition-colors duration-500 ${step === 5 ? "bg-[#6d5dfc]/10" : ""}`}>
                <span>user_k3x9</span>
                <span className="text-right tabular-nums">${cost.toFixed(2)}</span>
                <span className={`text-right tabular-nums transition-colors ${revenue === 0 ? "text-black/40" : margin < 0 ? "text-red-600" : "text-green-600"}`}>
                  {revenue === 0 ? "—" : `${margin < 0 ? "−" : "+"}$${Math.abs(margin).toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>
          <div
            className={`absolute left-1/2 top-full mt-2 w-max -translate-x-1/2 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[clamp(7px,0.95cqw,11px)] text-red-600 shadow-lg transition-all duration-500 ${
              alert ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
            }`}
          >
            🔔 user_k3x9 passed the $5 budget
          </div>
        </Node>

        {/* the moving packet */}
        {current.packet && !reduced && <Packet key={`${loop}-${step}`} {...current.packet} />}
      </div>

      {/* captions */}
      <div className="flex flex-col items-center gap-3">
        <p className="min-h-[3rem] max-w-xl text-center text-base text-foreground/80 sm:text-lg" aria-live="polite">
          {current.caption}
        </p>
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? "w-6 bg-[#6d5dfc]" : i < step ? "w-1.5 bg-[#6d5dfc]/40" : "w-1.5 bg-black/10"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Node({ at, glow, children }: { at: Pt; glow: boolean; children: React.ReactNode }) {
  return (
    <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${at.x}%`, top: `${at.y}%` }}>
      <div className={`relative flex flex-col items-center transition-transform duration-500 ${glow ? "scale-[1.04]" : "scale-100"}`}>{children}</div>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[120px] rounded-2xl border border-black/10 bg-white/90 p-3 shadow-md backdrop-blur">
      <div className="mb-1.5 text-[clamp(8px,1.05cqw,12px)] font-semibold">{title}</div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mt-1.5 text-[clamp(8px,1cqw,11px)] font-medium text-black/50">{children}</div>;
}

/** A glowing dot with a label that travels from one node to another. */
function Packet({ from, to, label, color }: { from: Pt; to: Pt; label: string; color: string }) {
  const [pos, setPos] = useState(from);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setPos(to)));
    return () => cancelAnimationFrame(id);
  }, [to]);
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-[left,top] ease-in-out"
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, transitionDuration: "1100ms" }}
      aria-hidden
    >
      <div className="flex items-center gap-1.5 rounded-full border bg-white px-2 py-1 text-[clamp(8px,1cqw,12px)] font-medium shadow-lg" style={{ borderColor: color, color }}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: color }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
        </span>
        <span className="whitespace-nowrap">{label}</span>
      </div>
    </div>
  );
}

/** Types out text once. */
function Typed({ text, run }: { text: string; run: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 1)), 45);
    return () => clearInterval(id);
  }, [run, text]);
  return <span>{text.slice(0, n) || " "}</span>;
}

// Phones: the same story as a column of stops, the active ones lit up.
const MOBILE_ROWS: { key: keyof typeof NODES; name: string; detail: string }[] = [
  { key: "phone", name: "Your app", detail: "a user asks for something" },
  { key: "backend", name: "Your backend", detail: "meter.trackOpenAI(res, { userId })" },
  { key: "ai", name: "AI provider", detail: "OpenAI · Anthropic · Gemini" },
  { key: "fiscallm", name: "FiscaLLM", detail: "cost, revenue and margin per user" },
  { key: "rc", name: "RevenueCat", detail: "purchases and renewals" },
];

function MobileFlow({ step, cost, margin }: { step: number; cost: number; margin: number | null }) {
  const current = STEPS[step]!;
  const lit = new Set<string>();
  for (const [key, at] of Object.entries(NODES)) {
    if (current.packet && (current.packet.from === at || current.packet.to === at)) lit.add(key);
  }
  if (step === 0) lit.add("phone");
  if (step === 5 || step === 7) lit.add("fiscallm");
  return (
    <ol className="flex flex-col gap-2 sm:hidden">
      {MOBILE_ROWS.map((r) => {
        const on = lit.has(r.key);
        const sending = current.packet && current.packet.from === NODES[r.key];
        return (
          <li key={r.key}>
            <div
              className={`rounded-xl border px-4 py-3 transition-all duration-500 ${
                on ? "border-[#6d5dfc]/40 bg-[#6d5dfc]/[0.06] shadow-md shadow-indigo-500/10" : "border-black/5 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{r.name}</span>
                {r.key === "fiscallm" && (
                  <span className="font-mono text-xs tabular-nums">
                    ${cost.toFixed(2)}{" "}
                    {margin !== null && <span className={margin < 0 ? "text-red-600" : "text-green-600"}>{`${margin < 0 ? "−" : "+"}$${Math.abs(margin).toFixed(2)}`}</span>}
                  </span>
                )}
              </div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-black/50">{r.detail}</div>
              {r.key === "fiscallm" && step >= 7 && <div className="mt-1.5 text-xs text-red-600">🔔 user_k3x9 passed the $5 budget</div>}
            </div>
            {sending && current.packet && (
              <div className="my-1 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2 py-0.5 text-xs font-medium" style={{ borderColor: current.packet.color, color: current.packet.color }}>
                  <span className="h-1.5 w-1.5 animate-ping rounded-full" style={{ background: current.packet.color }} />
                  {current.packet.label} →
                </span>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
