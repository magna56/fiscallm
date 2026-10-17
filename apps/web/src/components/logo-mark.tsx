/** The FiscaLLM mark: an F whose arms read as bars, with a dot for the user. */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="fisca-mark" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6d5dfc" />
          <stop offset="0.55" stopColor="#a855f7" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#fisca-mark)" />
      <rect x="18" y="14" width="10" height="36" rx="5" fill="#fff" />
      <rect x="18" y="14" width="29" height="10" rx="5" fill="#fff" />
      <rect x="18" y="29" width="20" height="10" rx="5" fill="#fff" />
      <circle cx="43" cy="44" r="5.5" fill="#fff" fillOpacity=".95" />
    </svg>
  );
}
