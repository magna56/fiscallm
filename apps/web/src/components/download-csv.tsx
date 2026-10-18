/** A plain link to a CSV export route; the browser downloads the file. */
export function DownloadCsv({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-black/70 transition hover:border-black/20 hover:bg-black/[0.02]"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" />
      </svg>
      Download CSV
    </a>
  );
}
