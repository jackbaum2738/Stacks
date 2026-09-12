"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateFirstLibraryForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
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
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
      <div className="space-y-1">
        <label htmlFor="firstLibraryName" className="text-sm font-medium">
          Library name
        </label>
        <input
          id="firstLibraryName"
          autoFocus
          required
          placeholder="e.g. My Library"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
      >
        {busy ? "Creating…" : "Create library"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
