import { ImageResponse } from "next/og";

// Shared social card for the pricing and comparison pages: a title and up
// to three big numbers, in the same look as the home page card.

export const OG_SIZE = { width: 1200, height: 630 };

export function ogCard({ eyebrow, title, stats }: { eyebrow: string; title: string; stats: [label: string, value: string][] }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #eef0ff 0%, #ffffff 45%, #fdeefb 100%)",
          color: "#0b0b14",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 700 }}>
          <svg width="52" height="52" viewBox="0 0 64 64">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#6d5dfc" />
                <stop offset="0.55" stopColor="#a855f7" />
                <stop offset="1" stopColor="#ec4899" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="16" fill="url(#g)" />
            <rect x="18" y="14" width="10" height="36" rx="5" fill="#fff" />
            <rect x="18" y="14" width="29" height="10" rx="5" fill="#fff" />
            <rect x="18" y="29" width="20" height="10" rx="5" fill="#fff" />
            <circle cx="43" cy="44" r="5.5" fill="#fff" />
          </svg>
          FiscaLLM
          <span style={{ marginLeft: 12, fontSize: 26, fontWeight: 500, color: "#6d5dfc" }}>{eyebrow}</span>
        </div>

        <div style={{ display: "flex", fontSize: title.length > 40 ? 60 : 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>

        <div style={{ display: "flex", gap: 20 }}>
          {stats.map(([label, value]) => (
            <div
              key={label}
              style={{ display: "flex", flexDirection: "column", flex: 1, padding: "20px 26px", borderRadius: 24, background: "white", border: "1px solid #e5e5ef" }}
            >
              <span style={{ fontSize: 24, color: "#55556a" }}>{label}</span>
              <span style={{ fontSize: 46, fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
