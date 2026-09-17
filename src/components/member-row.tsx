"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EditableRole = "ADMIN" | "MEMBER" | "VIEW_ONLY";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEW_ONLY: "View Only",
};

export function MemberRow({
  member,
  canManage,
  isOwnerViewer,
  isSelf,
}: {
  member: { id: string; role: string; user: { name: string | null; email: string } };
  canManage: boolean;
  /** Whether the signed-in viewer is this library's Owner -- only they can transfer ownership. */
  isOwnerViewer: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`Remove ${member.user.name || member.user.email} from this library?`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/library/members/${member.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    router.refresh();
  }

  async function changeRole(role: EditableRole) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/library/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    router.refresh();
  }

  async function makeOwner() {
    if (
      !window.confirm(
        `Make ${member.user.name || member.user.email} the owner of this library? You'll become an Admin.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/library/transfer-ownership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipId: member.id }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      return;
    }
    router.refresh();
  }

  const canEditThisRole = canManage && member.role !== "OWNER";

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display font-medium text-ink">
            {member.user.name || member.user.email}
            {isSelf && <span className="ml-1.5 font-sans text-sm font-normal text-ink-soft">(you)</span>}
          </p>
          <p className="truncate font-sans text-sm text-ink-soft">{member.user.email}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {canEditThisRole ? (
            <select
              value={member.role}
              disabled={busy}
              onChange={(e) => changeRole(e.target.value as EditableRole)}
              className="rounded-[2px] border border-line-strong bg-bg px-2 py-1 font-mono text-[11px] font-medium tracking-[.08em] text-ink uppercase"
            >
              <option value="ADMIN">Admin</option>
              <option value="MEMBER">Member</option>
              <option value="VIEW_ONLY">View Only</option>
            </select>
          ) : (
            <span className="rounded-[2px] bg-bg px-[9px] py-1 font-mono text-[11px] font-medium tracking-[.10em] text-ink-soft uppercase">
              {ROLE_LABEL[member.role] ?? member.role}
            </span>
          )}
          {isOwnerViewer && member.role !== "OWNER" && (
            <button
              onClick={makeOwner}
              disabled={busy}
              className="rounded-[2px] border border-line-strong px-3 py-1.5 font-sans text-sm font-medium text-ink hover:bg-chip-hover"
            >
              Make owner
            </button>
          )}
          {canManage && member.role !== "OWNER" && (
            <button
              onClick={remove}
              disabled={busy}
              className="rounded-[2px] border border-line-strong px-3 py-1.5 font-sans text-sm font-medium text-accent hover:bg-chip-hover"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-1 font-mono text-xs text-accent">{error}</p>}
    </li>
  );
}
