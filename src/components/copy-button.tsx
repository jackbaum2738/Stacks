"use client";

import { useState } from "react";

/** Copies `value` to the clipboard verbatim — no reformatting — with a brief inline "Copied" confirmation. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        onClick={onClick}
        aria-label={`Copy ${label}`}
        className={`inline-flex items-center justify-center rounded-[2px] p-[3px] hover:bg-chip-hover ${
          copied ? "text-ok" : "text-ink-faint hover:text-ink"
        }`}
      >
        {copied ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[13px] w-[13px]">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[13px] w-[13px]">
            <rect x="8" y="8" width="12" height="12" rx="1" />
            <path d="M5 15V5a1 1 0 0 1 1-1h10" />
          </svg>
        )}
      </button>
      <span
        className={`overflow-hidden font-mono text-[10px] whitespace-nowrap text-ok transition-all duration-150 ${
          copied ? "ml-1 max-w-[80px] opacity-100" : "max-w-0 opacity-0"
        }`}
      >
        Copied
      </span>
    </span>
  );
}
