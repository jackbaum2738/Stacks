"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formLabelClass, formInputClass } from "@/lib/form-styles";

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
        <label htmlFor="firstLibraryName" className={formLabelClass}>
          Library name
        </label>
        <input
          id="firstLibraryName"
          autoFocus
          required
          placeholder="e.g. My Library"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={formInputClass}
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-[2px] bg-accent py-3 font-sans font-medium text-on-accent hover:brightness-95 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create library"}
      </button>
      {error && <p className="font-mono text-xs text-accent">{error}</p>}
    </form>
  );
}
