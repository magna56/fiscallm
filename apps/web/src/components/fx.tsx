"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Calls `onEnter` once, the first time the element scrolls into view. */
function useInView<T extends Element>(onEnter: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          onEnter();
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
    // onEnter is stable for each use below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

/** Counts from 0 to `to` when scrolled into view. Renders the final value on the server. */
export function CountUp({ to, prefix = "", suffix = "", duration = 1400 }: { to: number; prefix?: string; suffix?: string; duration?: number }) {
  const [value, setValue] = useState(to);
  const ref = useInView<HTMLSpanElement>(() => {
    if (reducedMotion()) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    setValue(0);
    requestAnimationFrame(tick);
  });
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {value}
      {suffix}
    </span>
  );
}

/** Children with `.spot` get a glow that follows the mouse. */
export function Spotlight({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      onMouseMove={(e) => {
        for (const card of e.currentTarget.querySelectorAll<HTMLElement>(".spot")) {
          const r = card.getBoundingClientRect();
          card.style.setProperty("--x", `${e.clientX - r.left}px`);
          card.style.setProperty("--y", `${e.clientY - r.top}px`);
        }
      }}
    >
      {children}
    </div>
  );
}

export type CodeToken = [text: string, color?: string];

/** Types the code out when it scrolls into view; shows it all without JS or with reduced motion. */
export function Typewriter({ tokens, speed = 14 }: { tokens: CodeToken[]; speed?: number }) {
  const total = tokens.reduce((n, [t]) => n + t.length, 0);
  const [shown, setShown] = useState(total);
  const [typing, setTyping] = useState(false);
  const ref = useInView<HTMLPreElement>(() => {
    if (reducedMotion()) return;
    setShown(0);
    setTyping(true);
    let n = 0;
    const id = setInterval(() => {
      n += 2;
      setShown(Math.min(n, total));
      if (n >= total) {
        clearInterval(id);
        setTyping(false);
      }
    }, speed);
  });

  // How much of each token is visible so far.
  const offsets = tokens.map((_, i) => tokens.slice(0, i).reduce((n, [t]) => n + t.length, 0));
  return (
    <pre ref={ref} className="min-h-[300px] overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-white/90">
      <code>
        {tokens.map(([text, color], i) =>
          shown > offsets[i]! ? (
            <span key={i} style={color ? { color } : undefined}>
              {text.slice(0, shown - offsets[i]!)}
            </span>
          ) : null,
        )}
        <span className={`caret ${typing ? "" : "caret-idle"}`} aria-hidden />
      </code>
    </pre>
  );
}

/** A code card with language tabs; each tab types itself out. */
export function CodeTabs({ tabs }: { tabs: { label: string; file: string; tokens: CodeToken[] }[] }) {
  const [active, setActive] = useState(0);
  const tab = tabs[active]!;
  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-[#0f0f1a] shadow-2xl">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-xs text-white/50">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <div className="ml-3 flex gap-1" role="tablist">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={`rounded-md px-2.5 py-1 transition ${i === active ? "bg-white/10 text-white" : "hover:text-white/80"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="ml-auto">{tab.file}</span>
      </div>
      {/* key: a fresh typewriter per tab */}
      <Typewriter key={tab.label} tokens={tab.tokens} />
    </div>
  );
}
