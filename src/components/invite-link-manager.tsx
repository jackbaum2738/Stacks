"use client";

import { useEffect, useState } from "react";

export function InviteLinkManager() {
  const [inviteCode, setInviteCode] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/library/invite")
      .then((res) => (res.ok ? res.json() : { inviteCode: null }))
      .then((data) => setInviteCode(data.inviteCode ?? null));
  }, []);

  async function generate() {
    setBusy(true);
    const res = await fetch("/api/library/invite", { method: "POST" });
    const data = await res.json();
    setInviteCode(data.inviteCode ?? null);
    setBusy(false);
    setCopied(false);
  }

  const link = inviteCode && typeof window !== "undefined" ? `${window.location.origin}/join/${inviteCode}` : "";

  return (
    <div className="space-y-3 border border-line bg-surface p-4">
      <div>
        <h2 className="font-mono text-[11px] tracking-[.16em] text-ink-soft uppercase">Invite link</h2>
        <p className="mt-1 font-sans text-sm text-ink-soft">
          Anyone with this link can create an account (or sign in) and join this library.
        </p>
      </div>

      {inviteCode === undefined ? (
        <p className="font-sans text-sm text-ink-soft">Loading…</p>
      ) : inviteCode ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 border-b border-line-strong bg-transparent px-0.5 py-2 font-mono text-sm text-ink"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(link).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="rounded-[2px] border border-line-strong px-3 py-2 font-sans text-sm font-medium text-ink hover:bg-chip-hover"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-[2px] border border-line-strong px-3 py-2 font-sans text-sm font-medium text-accent hover:bg-chip-hover"
          >
            Regenerate (invalidates old link)
          </button>
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-[2px] bg-ink px-4 py-2 font-sans text-sm font-medium text-surface hover:brightness-95"
        >
          {busy ? "Generating…" : "Generate invite link"}
        </button>
      )}
    </div>
  );
}
