"use client";

import { useEffect, useState } from "react";
import type { SentInvite } from "@/components/send-invite-form";

const ROLE_LABEL: Record<string, string> = { ADMIN: "Admin", MEMBER: "Member", VIEW_ONLY: "View Only" };

/** Matches the resend route's own cooldown -- see src/app/api/library/invites/[id]/resend/route.ts. */
const RESEND_COOLDOWN_MS = 60_000;

export function OpenInviteRow({
  invite,
  onCancelled,
  onResent,
}: {
  invite: SentInvite;
  onCancelled: (id: string) => void;
  onResent: (id: string, lastSentAt: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const remaining = new Date(invite.lastSentAt).getTime() + RESEND_COOLDOWN_MS - Date.now();
    if (remaining <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [invite.lastSentAt]);

  const remainingMs = Math.max(0, new Date(invite.lastSentAt).getTime() + RESEND_COOLDOWN_MS - now);
  const onCooldown = remainingMs > 0;

  async function cancel() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/library/invites/${invite.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError("Couldn't cancel — please try again.");
      return;
    }
    onCancelled(invite.id);
  }

  async function resend() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/library/invites/${invite.id}/resend`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't resend — please try again.");
      return;
    }
    const data = await res.json();
    setNow(Date.now());
    onResent(invite.id, data.lastSentAt);
  }

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display font-medium text-ink">{invite.email}</p>
          <p className="truncate font-sans text-sm text-ink-soft">Invited as {ROLE_LABEL[invite.role] ?? invite.role}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={resend}
            disabled={busy || onCooldown}
            className="rounded-[2px] border border-line-strong px-3 py-1.5 font-sans text-sm font-medium text-ink hover:bg-chip-hover disabled:opacity-50"
          >
            {onCooldown ? `Resend in ${Math.ceil(remainingMs / 1000)}s` : "Resend"}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="rounded-[2px] border border-line-strong px-3 py-1.5 font-sans text-sm font-medium text-accent hover:bg-chip-hover disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
      {error && <p className="mt-1 font-mono text-xs text-accent">{error}</p>}
    </li>
  );
}
