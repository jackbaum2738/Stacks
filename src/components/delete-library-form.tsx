"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteLibraryForm({ libraryName }: { libraryName: string }) {
  const router = useRouter();
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/library", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmName }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-3 border border-line-strong bg-surface p-4">
      <div>
        <h2 className="font-mono text-[11px] tracking-[.16em] text-accent uppercase">Delete this library</h2>
        <p className="mt-1 font-sans text-sm text-ink-soft">
          Permanently deletes {libraryName}, every shelf, book, and reservation in it, for everyone with
          access. This can&apos;t be undone.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
        <input
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={`Type "${libraryName}" to confirm`}
          className="min-w-0 flex-1 border-b border-line-strong bg-transparent px-0.5 py-2 font-sans text-sm text-ink placeholder:text-ink-faint focus-visible:border-accent focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={busy || confirmName !== libraryName}
          className="rounded-[2px] bg-accent px-4 py-2 font-sans text-sm font-medium text-on-accent hover:brightness-95 disabled:opacity-40"
        >
          Delete library
        </button>
      </form>
      {error && <p className="font-mono text-xs text-accent">{error}</p>}
    </div>
  );
}
