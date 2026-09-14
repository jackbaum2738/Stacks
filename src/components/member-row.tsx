"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MemberRow({
  member,
  canManage,
}: {
  member: { id: string; role: string; user: { name: string | null; email: string } };
  canManage: boolean;
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

  return (
    <li className="py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display font-medium text-ink">{member.user.name || member.user.email}</p>
          <p className="font-sans text-sm text-ink-soft">{member.user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-[2px] bg-bg px-[9px] py-1 font-mono text-[11px] font-medium tracking-[.10em] text-ink-soft uppercase">
            {member.role}
          </span>
          {canManage && (
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
