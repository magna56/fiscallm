"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LogoMark } from "./logo-mark";

// An animated walk-through of one request: app → backend → AI provider,
// usage → FiscaLLM, revenue from RevenueCat or Stripe, then a budget alert back to
// the backend. Positions are percentages of a fixed-ratio canvas.

type Pt = { x: number; y: number };
const NODES = {
  phone: { x: 10.5, y: 47 },
  backend: { x: 41, y: 46 },
  ai: { x: 77, y: 17 },
  rc: { x: 40, y: 86 },
  fiscallm: { x: 77, y: 66 },
} satisfies Record<string, Pt>;

// `at` is where along the line (0 to 1) the label sits, chosen to stay clear of the cards.
const EDGES: { a: Pt; b: Pt; label: string; at: number }[] = [
  { a: NODES.phone, b: NODES.backend, label: "request", at: 0.5 },
  { a: NODES.backend, b: NODES.ai, label: "prompt and answer", at: 0.55 },
  { a: NODES.backend, b: NODES.fiscallm, label: "usage", at: 0.5 },
  { a: NODES.rc, b: NODES.fiscallm, label: "payments", at: 0.43 },
];

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
  { caption: "Your billing, RevenueCat or Stripe, reports what the same user paid.", packet: { from: NODES.rc, to: NODES.fiscallm, label: "renewal +$7.49", color: "#16a34a" } },
  { caption: "Cost passes the user's budget, so you get an alert…" },
  { caption: "…and a webhook your backend can act on.", packet: { from: NODES.fiscallm, to: NODES.backend, label: "slow down user_k3x9", color: "#dc2626" } },
];
const STEP_MS = 1900;
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
  const pk = current.packet;
  const edgeOn = (e: { a: Pt; b: Pt }) => Boolean(pk && ((pk.from === e.a && pk.to === e.b) || (pk.from === e.b && pk.to === e.a)));
  const barMax = Math.max(cost, revenue || 7.49);

  return (
    <div ref={ref} className="flex flex-col gap-5">
      <MobileFlow step={step} cost={cost} margin={revenue === 0 ? null : margin} />
      <div
        className="relative hidden w-full overflow-hidden rounded-[28px] border border-black/[0.06] bg-gradient-to-br from-[#f6f5ff] via-white to-[#fff3fa] shadow-[0_30px_80px_-40px_rgba(109,93,252,0.45)] sm:block"
        style={{ aspectRatio: "16 / 8.6", containerType: "inline-size" }}
      >
        <div className="dot-grid opacity-70" aria-hidden />
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#6d5dfc]/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-28 right-0 h-80 w-80 rounded-full bg-[#ec4899]/15 blur-3xl" aria-hidden />

        {/* connections */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {EDGES.map((e, i) => (
            <line key={i} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} stroke="rgba(109,93,252,0.18)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          ))}
          {EDGES.map((e, i) =>
            edgeOn(e) && pk ? (
              <g key={`on${i}`}>
                <line x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} stroke={pk.color} strokeOpacity="0.18" strokeWidth="9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <line className="flow-line" x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} stroke={pk.color} strokeWidth="2.5" strokeDasharray="7 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </g>
            ) : null,
          )}
        </svg>

        {/* edge labels */}
        {EDGES.map((e) => (
          <div
            key={e.label}
            className={`absolute z-[5] -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-0.5 text-[clamp(9px,1.05cqw,12px)] font-medium transition-colors duration-500 ${
              edgeOn(e) ? "border-[#6d5dfc]/30 bg-white text-[#4c3fd1] shadow-sm" : "border-black/5 bg-white/70 text-black/40"
            }`}
            style={{ left: `${e.a.x + (e.b.x - e.a.x) * e.at}%`, top: `${e.a.y + (e.b.y - e.a.y) * e.at}%` }}
          >
            {e.label}
          </div>
        ))}

        {/* phone */}
        <Node at={NODES.phone} glow={step <= 1}>
          <div className="w-[16cqw] min-w-[120px] rounded-[26px] border-[3px] border-[#14141f] bg-white p-3 shadow-xl">
            <div className="mx-auto mb-2.5 h-1.5 w-10 rounded-full bg-black/15" />
            <div className="mb-2 flex items-center gap-1.5 text-[clamp(9px,1.1cqw,13px)] font-semibold">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-[#6d5dfc] to-[#ec4899] text-[9px] text-white">AI</span>
              Writing helper
            </div>
            <div className="space-y-2 text-[clamp(9px,1.15cqw,13px)]">
              <div className="ml-auto w-fit max-w-full rounded-2xl rounded-br-md bg-[#6d5dfc] px-2.5 py-1.5 text-white">
                <Typed text="Rewrite my essay" run={step >= 0} key={`${loop}-q`} />
              </div>
              <div className={`w-fit rounded-2xl rounded-bl-md bg-black/[0.06] px-2.5 py-1.5 transition-all duration-500 ${step >= 4 ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"}`}>
                Here&apos;s a sharper version…
              </div>
            </div>
          </div>
          <Label>Your app</Label>
        </Node>

        {/* backend */}
        <Node at={NODES.backend} glow={[1, 2, 3, 4, 8].includes(step)}>
          <Box title="Your backend" wide>
            <div className="space-y-1 whitespace-nowrap rounded-xl bg-[#0f0f1a] p-2.5 font-mono text-[clamp(7px,0.88cqw,11px)] leading-relaxed text-white/60">
              <div className={`transition-colors duration-500 ${step === 2 || step === 3 ? "text-white" : ""}`}>
                <span className="text-[#c792ea]">const</span> res = <span className="text-[#c792ea]">await</span> ai.<span className="text-[#82aaff]">create</span>(…)
              </div>
              <div className={`rounded px-1 transition-all duration-500 ${step === 4 ? "bg-[#6d5dfc]/40 text-white" : ""}`}>
                meter.<span className="text-[#82aaff]">trackOpenAI</span>(res, {"{ userId }"})
              </div>
            </div>
            <div className={`mt-2 rounded-lg px-2.5 py-1 text-[clamp(8px,1cqw,12px)] font-medium transition-all duration-500 ${step === 8 ? "scale-100 bg-red-50 text-red-600 opacity-100" : "scale-95 bg-transparent text-transparent opacity-0"}`}>
              ⚡ user_k3x9 slowed down
            </div>
          </Box>
        </Node>

        {/* AI providers */}
        <Node at={NODES.ai} glow={step === 2 || step === 3}>
          <Box title="AI provider">
            <div className="flex flex-wrap gap-1.5">
              {["OpenAI", "Anthropic", "Gemini"].map((p) => (
                <span key={p} className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[clamp(8px,1cqw,12px)]">
                  {p}
                </span>
              ))}
            </div>
            <div className={`mt-2 flex items-center gap-1 text-[clamp(8px,1cqw,12px)] text-[#a855f7] transition-opacity duration-300 ${step === 2 ? "opacity-100" : "opacity-0"}`}>
              <span className="dot-bounce" />
              <span className="dot-bounce [animation-delay:150ms]" />
              <span className="dot-bounce [animation-delay:300ms]" />
              <span className="ml-1">thinking</span>
            </div>
          </Box>
        </Node>

        {/* Billing: RevenueCat or Stripe */}
        <Node at={NODES.rc} glow={step === 6}>
          <Box title="Your billing">
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {["RevenueCat", "Stripe"].map((p) => (
                <span key={p} className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[clamp(8px,1cqw,12px)]">
                  {p}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 text-[clamp(8px,1.05cqw,12px)] text-black/60">
              <span>user_k3x9 · Pro monthly</span>
              <span className={`font-semibold text-green-600 transition-opacity duration-500 ${step >= 6 ? "opacity-100" : "opacity-0"}`}>+$7.49 ✓</span>
            </div>
          </Box>
        </Node>

        {/* FiscaLLM */}
        <Node at={NODES.fiscallm} glow={step >= 5}>
          <div className="w-[31cqw] min-w-[230px] rounded-3xl bg-gradient-to-br from-[#6d5dfc] via-[#a855f7] to-[#ec4899] p-[2px] shadow-2xl shadow-indigo-500/25">
            <div className="rounded-[22px] bg-white p-4">
              <div className="flex items-center justify-between text-[clamp(10px,1.3cqw,15px)] font-semibold">
                <span className="flex items-center gap-2">
                  <LogoMark className="h-5 w-5" />
                  FiscaLLM
                </span>
                <span className="flex items-center gap-1.5 text-[clamp(8px,0.95cqw,11px)] font-medium text-green-600">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                  </span>
                  live
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 text-[clamp(8px,1cqw,11px)] uppercase tracking-wide text-black/40">
                <span>user</span>
                <span className="text-right">AI cost</span>
                <span className="text-right">margin</span>
              </div>
              <div className={`mt-1 grid grid-cols-3 gap-1 rounded-lg px-1.5 py-1 font-mono text-[clamp(9px,1.15cqw,13px)] transition-colors duration-500 ${step === 5 ? "bg-[#6d5dfc]/10" : ""}`}>
                <span>user_k3x9</span>
                <span className="text-right tabular-nums">${cost.toFixed(2)}</span>
                <span className={`text-right font-semibold tabular-nums transition-colors ${revenue === 0 ? "text-black/40" : margin < 0 ? "text-red-600" : "text-green-600"}`}>
                  {revenue === 0 ? "—" : `${margin < 0 ? "−" : "+"}$${Math.abs(margin).toFixed(2)}`}
                </span>
              </div>
              {/* cost against revenue */}
              <div className="mt-3 space-y-1.5 text-[clamp(8px,1cqw,11px)] text-black/50">
                <div className="flex items-center gap-2">
                  <span className="w-12">Revenue</span>
                  <div className="h-2 flex-1 rounded-full bg-black/[0.05]">
                    <div className="h-2 rounded-full bg-green-500 transition-all duration-700" style={{ width: `${(revenue / barMax) * 100}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12">AI cost</span>
                  <div className="h-2 flex-1 rounded-full bg-black/[0.05]">
                    <div className={`h-2 rounded-full transition-all duration-700 ${margin < 0 && revenue > 0 ? "bg-red-500" : "bg-[#a855f7]"}`} style={{ width: `${(cost / barMax) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            className={`absolute left-1/2 top-full mt-3 w-max -translate-x-1/2 rounded-xl border border-red-200 bg-white px-3 py-2 text-[clamp(9px,1.1cqw,13px)] font-medium text-red-600 shadow-xl transition-all duration-500 ${
              alert ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
            }`}
          >
            🔔 user_k3x9 passed the $5 budget
          </div>
        </Node>

        {/* the moving packet */}
        {pk && !reduced && <Packet key={`${loop}-${step}`} {...pk} />}

        {/* step counter */}
        <div className="absolute bottom-3 left-4 z-10 rounded-full bg-white/80 px-3 py-1 text-[clamp(9px,1cqw,12px)] font-medium text-black/50 shadow-sm backdrop-blur">
          Step {step + 1} of {STEPS.length}
        </div>
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
      <div className={`relative flex flex-col items-center transition-transform duration-500 ${glow ? "scale-[1.05]" : "scale-100"}`}>{children}</div>
    </div>
  );
}

function Box({ title, wide, children }: { title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-black/[0.08] bg-white/95 p-3.5 shadow-lg backdrop-blur ${wide ? "w-[25cqw] min-w-[215px]" : "min-w-[150px]"}`}>
      <div className="mb-2 text-[clamp(10px,1.25cqw,14px)] font-semibold">{title}</div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 text-[clamp(9px,1.05cqw,12px)] font-medium text-black/50">{children}</div>;
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
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, transitionDuration: "1300ms" }}
      aria-hidden
    >
      <div
        className="flex items-center gap-2 rounded-full border-2 bg-white px-3 py-1.5 text-[clamp(9px,1.15cqw,13px)] font-semibold shadow-xl"
        style={{ borderColor: color, color, boxShadow: `0 10px 30px -8px ${color}88` }}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: color }} />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: color }} />
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
  { key: "rc", name: "RevenueCat or Stripe", detail: "purchases and renewals" },
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
