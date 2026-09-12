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
          <p className="font-medium">{member.user.name || member.user.email}</p>
          <p className="text-sm text-gray-500">{member.user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {member.role}
          </span>
          {canManage && (
            <button
              onClick={remove}
              disabled={busy}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-red-700 dark:border-gray-700 dark:text-red-400"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </li>
  );
}
