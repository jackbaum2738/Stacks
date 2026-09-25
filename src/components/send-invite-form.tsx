"use client";

import { useState } from "react";
import { formLabelClass, formInputClass } from "@/lib/form-styles";

type InvitableRole = "ADMIN" | "MEMBER" | "VIEW_ONLY";

export interface SentInvite {
  id: string;
  email: string;
  role: InvitableRole;
  createdAt: string;
  lastSentAt: string;
}

export function SendInviteForm({ code, onSent }: { code: string; onSent: (invite: SentInvite) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>("MEMBER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/${code}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    const data = await res.json();
    onSent(data.invite);
    setEmail("");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 border-b border-line-inner pb-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor="inviteEmail" className={formLabelClass}>
            Email
          </label>
          <input
            id="inviteEmail"
            type="email"
            required
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={formInputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="inviteRole" className={formLabelClass}>
            Access
          </label>
          <select
            id="inviteRole"
            value={role}
            onChange={(e) => setRole(e.target.value as InvitableRole)}
            className="rounded-[2px] border border-line-strong bg-bg px-2 py-[9px] font-mono text-[11px] font-medium tracking-[.08em] text-ink uppercase"
          >
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
            <option value="VIEW_ONLY">View Only</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-[2px] bg-accent px-4 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send invite"}
        </button>
      </div>
      {error && <p className="font-mono text-xs text-accent">{error}</p>}
    </form>
  );
}
