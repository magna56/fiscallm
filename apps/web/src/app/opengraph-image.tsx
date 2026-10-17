import { ImageResponse } from "next/og";

export const alt = "FiscaLLM: see the AI cost of every single user";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #eef0ff 0%, #ffffff 45%, #fdeefb 100%)",
          color: "#0b0b14",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, fontWeight: 700 }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
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
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 88, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            <span>See the AI cost of&nbsp;</span>
            <span style={{ color: "#8b5cf6" }}>every single user.</span>
          </div>
          <div style={{ fontSize: 34, color: "#55556a" }}>Matches each user&apos;s AI cost to what they pay you.</div>
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 28 }}>
          <div style={{ display: "flex", padding: "14px 26px", borderRadius: 999, background: "white", border: "1px solid #e5e5ef" }}>
            Loses money: user_k3x9 −$16.41
          </div>
          <div style={{ display: "flex", padding: "14px 26px", borderRadius: 999, background: "#0b0b14", color: "white" }}>fiscallm.com</div>
        </div>
      </div>
    ),
    size,
  );
}
