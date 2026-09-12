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
    <div className="space-y-3 rounded-lg border border-red-300 p-4 dark:border-red-900">
      <div>
        <h2 className="font-semibold text-red-700 dark:text-red-400">Delete this library</h2>
        <p className="text-sm text-gray-500">
          Permanently deletes {libraryName}, every shelf, book, and reservation in it, for everyone with
          access. This can&apos;t be undone.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
        <input
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={`Type "${libraryName}" to confirm`}
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <button
          type="submit"
          disabled={busy || confirmName !== libraryName}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Delete library
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
