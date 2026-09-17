"use client";

import { useEffect, useState } from "react";

type InvitableRole = "ADMIN" | "MEMBER" | "VIEW_ONLY";

const ROLE_META: { role: InvitableRole; label: string; blurb: string }[] = [
  { role: "ADMIN", label: "Invite as Admin", blurb: "Can manage shelves, invite links, import, and other members." },
  { role: "MEMBER", label: "Invite as Member", blurb: "Can scan, reserve, and edit books, but not manage settings." },
  { role: "VIEW_ONLY", label: "Invite as View Only", blurb: "Can browse the library, but can't make any changes." },
];

function RoleInviteLink({ role, label, blurb }: { role: InvitableRole; label: string; blurb: string }) {
  const [inviteCode, setInviteCode] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/library/invite?role=${role}`)
      .then((res) => (res.ok ? res.json() : { inviteCode: null }))
      .then((data) => setInviteCode(data.inviteCode ?? null));
  }, [role]);

  async function generate() {
    setBusy(true);
    const res = await fetch(`/api/library/invite?role=${role}`, { method: "POST" });
    const data = await res.json();
    setInviteCode(data.inviteCode ?? null);
    setBusy(false);
    setCopied(false);
  }

  const link = inviteCode && typeof window !== "undefined" ? `${window.location.origin}/join/${inviteCode}` : "";

  return (
    <div className="space-y-2 border-t border-line-inner pt-3 first:border-t-0 first:pt-0">
      <div>
        <h3 className="font-sans text-sm font-semibold text-ink">{label}</h3>
        <p className="mt-0.5 font-sans text-xs text-ink-soft">{blurb}</p>
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

export function InviteLinkManager() {
  return (
    <div className="space-y-4 border border-line bg-surface p-4">
      <div>
        <h2 className="font-mono text-[11px] tracking-[.16em] text-ink-soft uppercase">Invite links</h2>
        <p className="mt-1 font-sans text-sm text-ink-soft">
          Anyone with a link can create an account (or sign in) and join this library with that
          link&rsquo;s role.
        </p>
      </div>
      {ROLE_META.map(({ role, label, blurb }) => (
        <RoleInviteLink key={role} role={role} label={label} blurb={blurb} />
      ))}
    </div>
  );
}
