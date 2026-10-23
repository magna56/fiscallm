const ACCENT = "#6d5dfc";
const RED = "#dc2626";

type BoxProps = { x: number; y: number; w: number; h: number; title: string; lines?: string[]; accent?: boolean; mono?: boolean };

function Box({ x, y, w, h, title, lines = [], accent, mono }: BoxProps) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        fill={accent ? ACCENT : "currentColor"}
        fillOpacity={accent ? 0.08 : 0.04}
        stroke={accent ? ACCENT : "currentColor"}
        strokeOpacity={accent ? 0.5 : 0.25}
      />
      <text x={x + 16} y={y + 28} fontSize={14} fontWeight={600} fill="currentColor" fontFamily={mono ? "ui-monospace, monospace" : undefined}>
        {title}
      </text>
      {lines.map((l, i) => (
        <text key={l} x={x + 16} y={y + 50 + i * 19} fontSize={12.5} fill="currentColor" fillOpacity={0.7}>
          {l}
        </text>
      ))}
    </g>
  );
}

function Arrow({ d, color = "currentColor", dashed }: { d: string; color?: string; dashed?: boolean }) {
  const id = color === RED ? "arr-red" : color === ACCENT ? "arr-accent" : "arr";
  return <path d={d} fill="none" stroke={color} strokeWidth={2} strokeOpacity={color === "currentColor" ? 0.5 : 1} strokeDasharray={dashed ? "6 5" : undefined} markerEnd={`url(#${id})`} />;
}

function Label({ x, y, text, color, anchor = "middle" }: { x: number; y: number; text: string; color?: string; anchor?: "start" | "middle" }) {
  return (
    <text x={x} y={y} fontSize={12} textAnchor={anchor} fill={color ?? "currentColor"} fillOpacity={color ? 1 : 0.65} fontWeight={color ? 600 : 400}>
      {text}
    </text>
  );
}

export function ArchitectureDiagram() {
  return (
    <figure className="not-prose my-5 overflow-x-auto rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-3 sm:p-5">
      <svg
        viewBox="0 0 900 640"
        role="img"
        aria-label="Architecture: your backend sends token counts and your billing system sends payments to FiscaLLM, which prices and joins them per user, feeds the dashboard, alerts and caps, and answers meter.check with allow or refuse."
        className="mx-auto h-auto w-full min-w-[640px] text-foreground"
      >
        <defs>
          {[
            ["arr", "currentColor", 0.5],
            ["arr-accent", ACCENT, 1],
            ["arr-red", RED, 1],
          ].map(([id, fill, op]) => (
            <marker key={id as string} id={id as string} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={fill as string} fillOpacity={op as number} />
            </marker>
          ))}
        </defs>

        <text x={20} y={26} fontSize={12} fontWeight={700} letterSpacing={1} fill="currentColor" fillOpacity={0.55}>
          YOUR SIDE
        </text>
        <text x={360} y={26} fontSize={12} fontWeight={700} letterSpacing={1} fill={ACCENT}>
          FISCALLM
        </text>

        {/* FiscaLLM panel */}
        <rect x={350} y={36} width={530} height={452} rx={18} fill={ACCENT} fillOpacity={0.04} stroke={ACCENT} strokeOpacity={0.35} strokeDasharray="4 4" />

        {/* Left column */}
        <Box x={20} y={64} w={250} h={92} title="Your backend" lines={["AI call → provider, then", "meter.track() in the background"]} />
        <Box x={20} y={204} w={250} h={92} title="RevenueCat / your billing" lines={["purchases, renewals, refunds", "or your own revenue API calls"]} />
        <Box x={20} y={344} w={250} h={92} title="Your backend, before a call" lines={["meter.check(userId)", "optional, holds in outages"]} mono />

        {/* Endpoints */}
        <Box x={380} y={64} w={470} h={92} title="POST /api/v1/events" lines={["validate · price · dedupe", "→ ai_events + daily_user_cost (one transaction)"]} mono />
        <Box x={380} y={204} w={470} h={92} title="POST /api/webhooks/rc/:app" lines={["verify signature · dedupe · apply", "→ rc_events + subscribers"]} mono />
        <Box x={380} y={344} w={470} h={92} title="POST /api/v1/check" lines={["spent today vs the cap for this user", "→ allow or refuse"]} accent mono />

        {/* Arrows */}
        <Arrow d="M270 110 H378" color={ACCENT} />
        <Label x={324} y={100} text="token counts" />
        <Label x={324} y={134} text="no prompts" />
        <Arrow d="M270 250 H378" color={ACCENT} />
        <Label x={324} y={240} text="payments" />
        <Arrow d="M270 376 H378" color={ACCENT} />
        <Label x={324} y={366} text="user id" />
        <Arrow d="M378 410 H272" color={RED} dashed />
        <Label x={324} y={430} text="allow / refuse" color={RED} />

        {/* Joined metrics and outputs */}
        <Arrow d="M615 488 V528" color={ACCENT} />
        <Box x={380} y={532} w={470} h={92} title="Metrics: cost joined to revenue" lines={["per user, plan and trial", "→ dashboard · alerts · caps · weekly email"]} accent />
      </svg>
    </figure>
  );
}
