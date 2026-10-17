"use client";

import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="shrink-0 rounded border border-foreground/20 px-2 py-1 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

/** A value on one line with a copy button. */
export function CopyField({ value, secret = false }: { value: string; secret?: boolean }) {
  const [shown, setShown] = useState(!secret);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded bg-foreground/5 px-2 py-1.5 font-mono text-xs">
        {shown ? value : "•".repeat(24)}
      </code>
      {secret && (
        <button type="button" className="shrink-0 text-xs underline" onClick={() => setShown(!shown)}>
          {shown ? "Hide" : "Show"}
        </button>
      )}
      <CopyButton value={value} />
    </div>
  );
}
